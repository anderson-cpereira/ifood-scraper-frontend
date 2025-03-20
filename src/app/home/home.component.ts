import { Component, OnInit, OnDestroy, ChangeDetectorRef, Pipe, PipeTransform } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatRadioModule } from '@angular/material/radio'; // Adicionado
import { v4 as uuidv4 } from 'uuid';

// Interfaces (mantidas como estão)
interface ProdutoItem {
  produto: string;
  quantidade: number;
}

interface ProdutoDetalhe {
  id: number;
  nome: string;
  preco: string;
  detalhes: string;
  imagem_url: string | null;
  imagem_local: string | null;
}

interface ProdutoEscolhido {
  item: string;
  quantidade: number;
  produto: ProdutoDetalhe;
  custo: number;
}

interface Combinacao {
  item: string;
  quantidade: number;
  produto: ProdutoDetalhe;
  custo: number;
  diferenca: number;
}

interface Mercado {
  id: number;
  nome: string;
  rating: string;
  distancia: string;
  tempo_entrega: string;
  custo_entrega: string;
  imagem_url: string | null;
  url: string;
  imagem_local: string | null;
  produtos: { [key: string]: ProdutoDetalhe[] };
  custo_total: string;
  produtos_escolhidos: ProdutoEscolhido[];
  combinacoes: Combinacao[];
}

interface MelhorCompra {
  mercado: string;
  custo_total: string;
  produtos_escolhidos: ProdutoEscolhido[];
}

interface ScrapingResponse {
  status: string;
  melhor_compra: MelhorCompra;
  mercados: Mercado[];
  output_file: string;
  task_id: string;
}

@Pipe({
  name: 'sortByCost',
  standalone: true
})
export class SortByCostPipe implements PipeTransform {
  transform(mercados: Mercado[], order: 'asc' | 'desc' = 'asc'): Mercado[] {
    if (!mercados) return [];
    return mercados.sort((a, b) => {
      const custoA = parseFloat(a.custo_total.replace('R$', '').replace(',', '.').trim()) || 0;
      const custoB = parseFloat(b.custo_total.replace('R$', '').replace(',', '.').trim()) || 0;
      return order === 'asc' ? custoA - custoB : custoB - custoA;
    });
  }
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatExpansionModule,
    MatRadioModule, // Adicionado para suportar mat-radio-button
    SortByCostPipe
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnDestroy {
  produtos: ProdutoItem[] = [{ produto: '', quantidade: 1 }];
  maxProdutos: number = 1;
  resultado: ScrapingResponse | null = null;
  erro: string | null = null;
  isLoading: boolean = false;
  progresso: number = 0;
  mensagemProgresso: string = '';
  tipoSelecionado: 'mercados' | 'farmacias' = 'mercados'; // Valor padrão

  private sseSource: EventSource | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnDestroy() {
    if (this.sseSource) {
      this.sseSource.close();
    }
  }

  onTipoChange() {
    // Resetar resultados ao mudar o tipo
    this.resultado = null;
    this.erro = '';
    this.cdr.detectChanges();
  }

  conectarSSE(task_id: string) {    
    if (this.sseSource) {
      this.sseSource.close();
    }
    this.sseSource = new EventSource(`https://ifood-scraper-backend.onrender.com/progresso/${task_id}`);

    // Usar addEventListener para o evento específico 'progresso'
    this.sseSource.addEventListener('progresso', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.progresso = data.percentual;
        this.mensagemProgresso = data.mensagem;
        this.cdr.detectChanges();
        if (this.progresso >= 100) {
          if (this.sseSource) {
            this.sseSource.close();
          }
        }
      } catch (e) {
        console.error('Erro ao parsear mensagem SSE:', e);
      }
    });

    this.sseSource.onerror = (error) => {
      console.error('Erro na conexão SSE:', error);
      this.erro = 'Erro ao conectar ao servidor para atualizações de progresso.';
      this.cdr.detectChanges();
    };
  }

  adicionarProduto() {
    this.produtos.push({ produto: '', quantidade: 1 });
    setTimeout(() => {
      const container = document.querySelector('.produto-lista-container');
      if (container) container.scrollTop = container.scrollHeight;
    }, 0);
  }

  removerProduto(index: number) {
    if (this.produtos.length > 1) {
      this.produtos.splice(index, 1);
    }
  }

  scrape() {
    const body = this.produtos.filter(p => p.produto.trim() !== '');
    if (body.length === 0) {
      this.erro = 'Adicione pelo menos um produto válido.';
      this.cdr.detectChanges();
      return;
    }

    this.erro = null;
    this.resultado = null;
    this.isLoading = true;
    this.progresso = 0;
    this.mensagemProgresso = 'Iniciando...';
    this.cdr.detectChanges();

    const task_id = uuidv4();
    this.conectarSSE(task_id);

    // Ajuste da URL com base no tipo selecionado
    const type_search = this.tipoSelecionado === 'mercados' 
      ? 'M' 
      : 'F';

    this.http.post<ScrapingResponse>(
      `https://ifood-scraper-backend.onrender.com/scrape/?type_search=${type_search}&max_produtos=${this.maxProdutos}&task_id=${task_id}`,
      body
    ).subscribe({
      next: (response) => {
        this.resultado = response;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.erro = err.error?.detail || 'Erro ao executar o scraping.';
        this.isLoading = false;
        if (this.sseSource) {
          this.sseSource.close();
        }
        this.cdr.detectChanges();
      }
    });
  }

  getPrecoFormatado(preco: string): { atual: string; original?: string; desconto?: string } {
    if (!preco) return { atual: 'N/A' };
    const partes = preco.split('\n');
    if (partes.length === 1) return { atual: partes[0] };
    if (partes.length === 3) return { atual: partes[0], desconto: partes[1], original: partes[2] };
    return { atual: preco };
  }

  hasAnyProdutosEscolhidos(): boolean {
    if (!this.resultado || !this.resultado.mercados) return false;
    return this.resultado.mercados.some((mercado: Mercado) =>
      mercado.produtos_escolhidos && mercado.produtos_escolhidos.length > 0
    );
  }
}