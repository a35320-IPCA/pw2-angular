import { Component, OnInit, OnDestroy, Injectable, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, forkJoin, of, interval } from 'rxjs';
import { map, switchMap, catchError, timeout, finalize } from 'rxjs/operators';

// --- INTERFACES ---
export interface StockItem {
  ticker: string;
  empresa: string;
  dataCompra: string;
  quantidade: number;
  precoCompra: number;
}

export interface StockPortfolioResult extends StockItem {
  totalCompra: number;
  cotacaoAtual: number;
  valorAtual: number;
  variacaoPercentual: number;
}

export interface StockWatchItem {
  ticker: string;
  empresa: string;
  cotacaoAtual: number;
}

interface ChartPoint {
  label: string;
  value: number;
  x: number;
  y: number;
}

interface FinnhubQuote {
  c: number;
}

interface FinnhubCandle {
  c: number[];
  t: number[];
  s: string;
}

// --- SERVIÇO ---
@Injectable({
  providedIn: 'root'
})
export class StockService {
  private apiKey = 'd89dg9pr01qla01n4jpgd89dg9pr01qla01n4jq0';
  private apiUrl = 'https://finnhub.io/api/v1/quote';
  private candleApiUrl = 'https://finnhub.io/api/v1/stock/candle';
  private watchlistPadrao: Omit<StockWatchItem, 'cotacaoAtual'>[] = [
    { ticker: 'GOOGL', empresa: 'Alphabet Inc.' },
    { ticker: 'AMZN', empresa: 'Amazon.com, Inc.' },
    { ticker: 'NVDA', empresa: 'NVIDIA Corporation' },
    { ticker: 'META', empresa: 'Meta Platforms, Inc.' },
    { ticker: 'NFLX', empresa: 'Netflix, Inc.' }
  ];

  private http = inject(HttpClient);

  getPortfolioData(): Observable<StockItem[]> {
    return this.http.get<StockItem[]>('/carteira.json').pipe(
      catchError(() => of([]))
    );
  }

  getCryptoData(): Observable<any[]> {
    const cryptos = [
      { symbol: 'BTC', nome: 'Bitcoin', dataCompra: '2024-02-01', quantidade: 0.05, precoCompra: 45000 },
      { symbol: 'ETH', nome: 'Ethereum', dataCompra: '2024-03-15', quantidade: 0.7, precoCompra: 2800 }
    ];
    return of(cryptos);
  }

  getCotacao(ticker: string): Observable<number> {
    const url = `${this.apiUrl}?symbol=${ticker}&token=${this.apiKey}`;
    return this.http.get<FinnhubQuote>(url).pipe(
      map(res => {
        if (!res || res.c === 0) {
          return this.getPrecoSimulado(ticker);
        }
        return res.c;
      }),
      catchError(() => {
        console.warn(`API falhou para o ticker ${ticker}. A usar cotação simulada.`);
        return of(this.getPrecoSimulado(ticker));
      })
    );
  }

  getHistoricoCotacao(ticker: string, meses = 12): Observable<{ valores: number[]; labels: string[] }> {
    const to = Math.floor(Date.now() / 1000);
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - (meses - 1));
    const from = Math.floor(fromDate.getTime() / 1000);
    const url = `${this.candleApiUrl}?symbol=${ticker}&resolution=M&from=${from}&to=${to}&token=${this.apiKey}`;

    return this.http.get<FinnhubCandle>(url).pipe(
      timeout(8000),
      map((res) => {
        if (!res || res.s !== 'ok' || !res.c?.length || !res.t?.length) {
          throw new Error('Sem histórico válido da API.');
        }

        const pares = res.c
          .map((valor, index) => ({ valor, timestamp: res.t[index] }))
          .filter(item => Number.isFinite(item.valor) && Number.isFinite(item.timestamp))
          .slice(-meses);

        if (pares.length === 0) {
          throw new Error('Sem pontos históricos após filtragem.');
        }

        return {
          valores: pares.map(item => item.valor),
          labels: pares.map(item => new Date(item.timestamp * 1000).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' }))
        };
      })
    );
  }

  private getPrecoSimulado(ticker: string): number {
    if (ticker === 'MSFT') return 420.25;
    if (ticker === 'TSLA') return 175.40;
    if (ticker === 'AAPL') return 185.30;
    if (ticker === 'BTC') return 68250.00;
    if (ticker === 'ETH') return 3600.00;
    return 100.00;
  }

  precoSimulado(ticker: string): number {
    return this.getPrecoSimulado(ticker);
  }

  getAcoesNaoCompradas(carteira: StockItem[]): Observable<StockWatchItem[]> {
    const tickersComprados = new Set(carteira.map(item => item.ticker.toUpperCase()));
    const listaNaoComprada = this.watchlistPadrao.filter(item => !tickersComprados.has(item.ticker));

    if (listaNaoComprada.length === 0) {
      return of([]);
    }

    const pedidosMapeados = listaNaoComprada.map(item =>
      this.getCotacao(item.ticker).pipe(
        map((cotacao): StockWatchItem => ({
          ...item,
          cotacaoAtual: cotacao
        }))
      )
    );

    return forkJoin(pedidosMapeados);
  }

  private mapPortfolioData(itens: StockItem[]): Observable<StockPortfolioResult[]> {
    if (!itens || itens.length === 0) {
      return of([]);
    }

    const pedidosMapeados = itens.map(item =>
      this.getCotacao(item.ticker).pipe(
        map((cotacao: number): StockPortfolioResult => {
          const totalCompra = item.quantidade * item.precoCompra;
          const valorAtual = item.quantidade * cotacao;
          const variacaoPercentual = totalCompra > 0
            ? ((valorAtual - totalCompra) / totalCompra) * 100
            : 0;

          return {
            ...item,
            totalCompra,
            cotacaoAtual: cotacao,
            valorAtual,
            variacaoPercentual
          };
        })
      )
    );

    return forkJoin(pedidosMapeados);
  }

  get carteiraCompleta(): Observable<StockPortfolioResult[]> {
    return this.getPortfolioData().pipe(
      switchMap((itens: StockItem[]) => this.mapPortfolioData(itens))
    );
  }

  getResumoMercado(): Observable<{ carteira: StockPortfolioResult[]; observacao: StockWatchItem[] }> {
    return this.getPortfolioData().pipe(
      switchMap((itens: StockItem[]) => forkJoin({
        carteira: this.mapPortfolioData(itens),
        observacao: this.getAcoesNaoCompradas(itens)
      }))
    );
  }
}

// --- COMPONENTE PRINCIPAL ---
@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  titlo = 'Monitorização de Carteira de Ações';
  listaAcoes: StockPortfolioResult[] = [];
  listaAcoesObservacao: StockWatchItem[] = [];
  ultimaBuscaApi: Date | null = null;
  chartPoints: ChartPoint[] = [];
  chartPath = '';
  selectedTicker = '';
  selectedEmpresa = '';
  selectedPrice = 0;
  chartMinPrice = 0;
  chartMaxPrice = 0;
  chartCarregando = false;
  
  totalInvestidoGlobal = 0;
  valorAtualGlobal = 0;
  variacaoGlobal = 0;
  carregando = true;
  private refreshSubscription?: Subscription;

  constructor(private stockService: StockService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.carregarDados();
    this.refreshSubscription = interval(60000).subscribe(() => this.carregarDados());
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  atualizarAgora(): void {
    this.carregarDados();
  }

  carregarDados(): void {
    this.carregando = true;
    this.cdr.detectChanges();

    this.stockService.getResumoMercado().subscribe({
      next: (dados) => {
        this.listaAcoes = dados.carteira;
        this.listaAcoesObservacao = dados.observacao;
        this.calcularTotaisGlobais();
        this.ultimaBuscaApi = new Date();
        this.carregando = false;
        this.cdr.detectChanges(); 
      },
      error: (err) => {
        console.error('Erro geral na aplicação:', err);
        this.carregando = false;
        this.cdr.detectChanges();
      }
    });
  }

  calcularTotaisGlobais(): void {
    this.totalInvestidoGlobal = this.listaAcoes.reduce((acc, item) => acc + item.totalCompra, 0);
    this.valorAtualGlobal = this.listaAcoes.reduce((acc, item) => acc + item.valorAtual, 0);
    
    if (this.totalInvestidoGlobal > 0) {
      this.variacaoGlobal = ((this.valorAtualGlobal - this.totalInvestidoGlobal) / this.totalInvestidoGlobal) * 100;
    } else {
      this.variacaoGlobal = 0;
    }
  }

  getClasseVariacao(valor: number): string {
    if (valor > 0) return 'positivo';
    if (valor < 0) return 'negativo';
    return 'neutro';
  }

  mostrarGraficoAcaoComprada(acao: StockPortfolioResult): void {
    this.carregarGraficoLinhaApi(acao.ticker, acao.empresa, acao.cotacaoAtual, acao.precoCompra);
  }

  mostrarGraficoAcaoNaoComprada(acao: StockWatchItem): void {
    this.carregarGraficoLinhaApi(acao.ticker, acao.empresa, acao.cotacaoAtual);
  }

  private carregarGraficoLinhaApi(ticker: string, empresa: string, precoAtual: number, precoReferencia?: number): void {
    this.selectedTicker = ticker;
    this.selectedEmpresa = empresa;
    this.selectedPrice = precoAtual;

    const serieFallback = this.gerarSerieHistorica(ticker, precoAtual, precoReferencia);
    const labelsFallback = this.gerarLabelsMensais(serieFallback.length);
    this.montarGraficoLinha(serieFallback, labelsFallback);

    this.chartCarregando = true;

    this.stockService.getHistoricoCotacao(ticker, 12).pipe(
      finalize(() => {
        this.chartCarregando = false;
      })
    ).subscribe({
      next: (historico) => {
        this.montarGraficoLinha(historico.valores, historico.labels);
      },
      error: () => {}
    });
  }

  private montarGraficoLinha(serieValores: number[], labels: string[]): void {
    const min = Math.min(...serieValores);
    const max = Math.max(...serieValores);
    this.chartMinPrice = min;
    this.chartMaxPrice = max;

    const width = 760;
    const height = 280;
    const paddingX = 44;
    const paddingY = 30;
    const plotWidth = width - paddingX * 2;
    const plotHeight = height - paddingY * 2;
    const divisor = max - min || 1;
    const totalSegmentos = Math.max(serieValores.length - 1, 1);

    this.chartPoints = serieValores.map((value, index) => {
      const x = paddingX + (index * plotWidth) / totalSegmentos;
      const y = paddingY + ((max - value) / divisor) * plotHeight;

      return {
        label: labels[index] ?? '',
        value,
        x,
        y
      };
    });

    this.chartPath = this.chartPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(' ');
  }

  private gerarLabelsMensais(totalPontos: number): string[] {
    return Array.from({ length: totalPontos }, (_, index) => {
      const data = new Date();
      data.setMonth(data.getMonth() - (totalPontos - 1 - index));
      return data.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' });
    });
  }

  private gerarSerieHistorica(ticker: string, precoAtual: number, precoReferencia?: number): number[] {
    const totalPontos = 12;
    const base = precoReferencia && precoReferencia > 0 ? precoReferencia : precoAtual * 0.88;
    const tendencia = (precoAtual - base) / (totalPontos - 1);
    const seed = ticker.split('').reduce((acc, letra) => acc + letra.charCodeAt(0), 0);

    const serie = Array.from({ length: totalPontos }, (_, index) => {
      const ruido = Math.sin((index + 1) * 1.7 + seed) * 0.06;
      const variacao = base * ruido;
      return Math.max(1, base + tendencia * index + variacao);
    });

    serie[serie.length - 1] = precoAtual;
    return serie;
  }
}