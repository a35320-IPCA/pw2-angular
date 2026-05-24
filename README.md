# Monitorização de Carteira de Ações

Aplicação Angular para monitorizar uma carteira de ações com cotações obtidas por API REST. O objetivo é apresentar um resumo da carteira em tabela, com valores calculados automaticamente e formatação adequada ao enunciado.

## O que a aplicação faz

- Carrega a carteira inicial a partir de [public/carteira.json](public/carteira.json).
- Obtém a cotação atual de cada ação através da API do Finnhub.
- Calcula automaticamente:
	- total de aquisição por ação;
	- valor atual por ação;
	- variação percentual por linha;
	- totais globais da carteira.
- Apresenta a informação numa tabela com uma linha final `TOTAL`.
- Aplica cor à variação:
	- verde para variação positiva;
	- vermelho para variação negativa;
	- preto/neutro para variação nula.

## Estrutura dos dados

A carteira é definida em JSON com esta estrutura:

```json
{
	"ticker": "MSFT",
	"empresa": "Microsoft",
	"dataCompra": "2026-03-01",
	"quantidade": 20,
	"precoCompra": 320
}
```

Os campos `totalCompra`, `cotacaoAtual`, `valorAtual` e `variacaoPercentual` são calculados pela aplicação em tempo de execução.

## Como os valores são calculados

- `Total da linha = quantidade x precoCompra`
- `Valor atual = quantidade x cotacaoAtual`
- `Variação % = ((valorAtual - totalCompra) / totalCompra) x 100`
- `Total global = soma dos totais de aquisição`
- `Valor global atual = soma dos valores atuais`
- `Variação global = ((valorGlobalAtual - totalGlobal) / totalGlobal) x 100`

## API de cotações

As cotações vêm da API do Finnhub no serviço `StockService` em [src/app/app.ts](src/app/app.ts).

Se a API falhar, a aplicação usa um valor simulado de fallback para manter a interface funcional.

## Formatação

- O formato numérico usa locale `pt-PT`.
- As datas são apresentadas em formato `dd/MM/yyyy`.
- Os valores monetários são mostrados com duas casas decimais.

## Como correr o projeto

Instalar dependências:

```bash
npm install
```

Executar em desenvolvimento:

```bash
npm start
```

Depois abrir:

```text
http://localhost:4200/
```

Gerar build de produção:

```bash
npm run build
```

## Ficheiros principais

- [src/app/app.ts](src/app/app.ts): lógica principal, cálculo da carteira e chamadas à API.
- [src/app/app.html](src/app/app.html): tabela e resumo da carteira.
- [src/app/app.css](src/app/app.css): estilos da interface.
- [public/carteira.json](public/carteira.json): dados iniciais da carteira.
- [src/main.ts](src/main.ts): bootstrap da aplicação e configuração de locale.

## Observações

- O projeto está preparado para Angular standalone.
- O build atual já foi validado com sucesso.
