import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StockService } from './app';

export interface CryptoItem {
  symbol: string;
  nome: string;
  quantidade: number;
  precoCompra: number;
  dataCompra?: string;
}

@Component({
  selector: 'app-cryptos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cryptos.html',
  styleUrls: ['./cryptos.css']
})
export class CryptoComponent implements OnInit {
  listaCryptos: (CryptoItem & { precoAtual: number; valorAtual: number; variacaoPercentual: number })[] = [];
  carregando = true;

  constructor(private stockService: StockService) {}

  ngOnInit(): void {
    this.carregarCryptos();
  }

  carregarCryptos(): void {
    this.carregando = true;
    this.stockService.getCryptoData().subscribe({
      next: (dados) => {
        this.listaCryptos = dados.map(d => {
          const precoAtual = this.stockService.precoSimulado(d.symbol);
          const valorAtual = precoAtual * d.quantidade;
          const totalCompra = d.precoCompra * d.quantidade;
          const variacaoPercentual = totalCompra > 0 ? ((valorAtual - totalCompra) / totalCompra) * 100 : 0;
          return { ...d, precoAtual, valorAtual, variacaoPercentual };
        });
        this.carregando = false;
      },
      error: () => (this.carregando = false)
    });
  }
}
