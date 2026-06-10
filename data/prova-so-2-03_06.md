# Avaliação 2 — Sistemas Operacionais

**Instituto Federal de Santa Catarina (IFSC)**
**Curso:** Ciência da Computação
**Disciplina:** Sistemas Operacionais
**Professor:** Robson Costa
**Data:** 03/06/2026

---

## Questão 1 (1,0 ponto)

No projeto de sistemas operacionais, o mapeamento de instruções e dados contidos no código-fonte para endereços físicos de memória (_address binding_) pode ocorrer em diferentes etapas do ciclo de desenvolvimento e execução de um programa.

Suponha que um engenheiro de software esteja desenvolvendo uma aplicação industrial crítica para um microcontrolador que executa o código diretamente a partir da memória flash (ROM). Como a posição física inicial onde o programa residirá na memória é fixa e conhecida em tempo de projeto, o sistema não possui (e nem necessita de) uma Unidade de Gerenciamento de Memória (MMU) ou carregador dinâmico.

Considerando os cinco momentos de amarração de endereços (edição, compilação, ligação, carregamento e execução), assinale a alternativa que indica o momento correto em que o endereçamento deve ser resolvido para o cenário descrito e sua respectiva propriedade:

**a)** Na edição, onde o programador define manualmente os endereços físicos de todas as variáveis globais no editor de texto, eliminando a necessidade de ferramentas de automação e garantindo a portabilidade do código entre diferentes hardwares.

**b)** Na compilação (ou ligação), gerando código absoluto; os endereços físicos são fixados no arquivo binário final, o que maximiza o desempenho e elimina qualquer _overhead_ de tradução de endereços durante a inicialização ou execução do sistema.

**c)** No carregamento (_load time_), momento em que o compilador gera um código estritamente relocável e o sistema operacional calcula os deslocamentos de memória na RAM toda vez que o dispositivo é energizado.

**d)** Na execução (_runtime_), pois mesmo em hardwares simples sem MMU, o mapeamento dinâmico instrução por instrução feito via software é o único mecanismo capaz de garantir que o programa não sofra com travamentos por fragmentação.

**e)** Na ligação (_link time_) de forma dinâmica, onde as referências de memória são deixadas em aberto no arquivo binário para que o módulo seja acoplado a outras bibliotecas apenas quando o processador executar a primeira instrução de desvio (_jump_).

---

## Questão 2 (1,0 ponto)

Quando um programa executável é carregado na memória pelo sistema operacional, ele é organizado em um espaço de endereçamento lógico dividido em quatro regiões (segmentos) principais: **text**, **data**, **heap** e **stack**. Cada uma dessas regiões possui características específicas quanto à volatilidade dos dados, permissões de acesso e direção de crescimento.

Considere um cenário onde uma função em linguagem C realiza a leitura de dados de um sensor. Dentro dessa função, há uma variável local `int i` (usada como contador de um laço), um ponteiro que recebe o endereço de uma memória alocada dinamicamente via `malloc()` para armazenar as leituras do sensor, e o código binário (instruções em assembly) que executa a operação. Além disso, o programa faz uso de uma variável global `int status_sistema = 1` para controle de erros.

Assinale a alternativa que descreve corretamente a distribuição desses elementos nos respectivos espaços de memória e o comportamento dessas regiões.

**a)** O contador `int i` é armazenado no _heap_ devido à sua natureza volátil; o espaço alocado via `malloc()` fica no _stack_, crescendo em direção aos endereços mais altos da memória.

**b)** O código binário das instruções é armazenado no segmento **text** com permissões de escrita e execução; a variável global `status_sistema` fica no segmento **data**, que possui tamanho estático definido em tempo de compilação.

**c)** O contador `int i` é alocado no **stack**; o espaço para os dados do sensor gerado por `malloc()` é alocado no **heap**; e as instruções do programa residem no segmento **text**, que geralmente é marcado como somente leitura (_read-only_).

**d)** As regiões do **heap** e do **stack** possuem tamanhos fixos idênticos alocados na inicialização do processo e crescem na mesma direção da memória, evitando que uma região sobrescreva a outra em caso de _overflow_.

**e)** A variável global `status_sistema` é alocada no **stack** por ser compartilhada entre funções, enquanto todas as constantes do código e literais de string são empurradas para o **heap** durante a execução.

---

## Questão 3 (1,0 ponto)

No gerenciamento de memória por **alocação contígua**, cada programa ocupa um bloco único e ininterrupto de endereços físicos na memória RAM. À medida que processos são criados e encerrados, a memória tende a se fragmentar.

Considere um sistema operacional que utiliza alocação contígua com partições dinâmicas e que, em um determinado instante, possui quatro lacunas (_holes_) livres na memória, ordenadas pelo endereço físico inicial:

| Lacuna   | Tamanho |
| -------- | ------- |
| Lacuna 1 | 200 KB  |
| Lacuna 2 | 500 KB  |
| Lacuna 3 | 150 KB  |
| Lacuna 4 | 300 KB  |

Suponha que três novos processos de tamanho fixo cheguem consecutivamente na seguinte ordem de requisição:

- **P₁:** 120 KB
- **P₂:** 280 KB
- **P₃:** 180 KB

Considerando a aplicação estrita do algoritmo **best-fit** (melhor escolha) para acomodar essa sequência de processos, assinale a alternativa correta:

**a)** O processo P₁ será alocado na Lacuna 1, P₂ na Lacuna 4, e P₃ ocupará o restante da Lacuna 1; o sistema sofrerá exclusivamente de fragmentação interna.

**b)** O algoritmo _best-fit_ falhará ao tentar alocar o processo P₃, resultando em um cenário de fragmentação externa, cuja única solução imediata sem _swap_ seria um processo de compactação de memória.

**c)** Todos os três processos serão alocados com sucesso, restando ao final do processo uma lacuna totalmente livre de 500 KB (Lacuna 2) e gerando pequenos resíduos de fragmentação externa nas demais.

**d)** O processo P₂ será obrigatoriamente alocado na Lacuna 2 por ser a maior disponível, seguindo a premissa do algoritmo de deixar o maior espaço residual possível para requisições futuras.

**e)** A alocação contígua dinâmica com _best-fit_ elimina completamente a fragmentação externa, pois o algoritmo varre a memória de forma linear para garantir que os processos fiquem perfeitamente compactados no topo da RAM.

---

## Questão 4 (2,0 pontos)

Ao se utilizar a alocação de memória paginada em uma arquitetura computacional de **32 bits**, se reservarmos **14 bits para o offset** e **18 bits para o número de páginas**, responda (apresentando o cálculo completo):

**a)** Qual o tamanho de cada página?

**b)** Qual o número de páginas?

**c)** Qual o tamanho máximo de memória endereçável?

---

## Questão 5 (1,0 ponto)

No subsistema de gerência de arquivos de um sistema operacional, a identificação do tipo e do formato de um arquivo é fundamental para que o sistema saiba como processar seus dados e qual aplicação deve manipulá-lo. Sistemas como o Microsoft Windows historicamente confiam nas extensões de arquivos (como `.exe`, `.txt`, `.png`) para essa associação. Por outro lado, sistemas baseados em Unix/Linux frequentemente utilizam os chamados **magic numbers** (números mágicos).

Considere um cenário em que um usuário mal-intencionado altere manualmente o nome de um script malicioso em Python de `script.py` para `foto.png` em um servidor Linux, na tentativa de ludibriar o administrador do sistema.

Com base nos conceitos de organização de arquivos e _magic numbers_, assinale a alternativa que descreve corretamente o comportamento do sistema operacional ou das ferramentas de auditoria padrão (como o comando `file` do Linux) diante dessa alteração:

**a)** O sistema operacional Linux passará a renderizar o arquivo como uma imagem rasterizada estática, pois a alteração da extensão modifica automaticamente o cabeçalho (_header_) interno do arquivo para o formato padrão PNG.

**b)** O comando `file` falhará em identificar o arquivo, gerando um erro de segmentação, uma vez que a tabela de alocação de arquivos do sistema de arquivos (como o EXT4) exige congruência absoluta entre extensão nominal e formato binário.

**c)** O arquivo continuará sendo identificado essencialmente como um arquivo de texto/script (código-fonte), pois o sistema lerá os primeiros bytes do arquivo para verificar o _magic number_, ignorando a extensão `.png` para fins de determinação do tipo real.

**d)** Os _magic numbers_ são metadados armazenados exclusivamente fora do arquivo, dentro dos nós de índice (_inodes_); portanto, ao alterar a extensão, o _inode_ é atualizado automaticamente para refletir que o arquivo agora armazena pixels e não texto executável.

**e)** O interpretador Python do sistema operacional se recusará a executar o arquivo se ele for chamado via linha de comando, pois os sistemas operacionais modernos bloqueiam a execução de qualquer arquivo cujo _magic number_ não coincida textualmente com a sua extensão nominal.

---

## Questão 6 (1,0 ponto)

Durante o projeto de subsistemas de armazenamento em sistemas operacionais, a escolha do método de alocação de blocos em disco impacta diretamente o desempenho, a fragmentação e a flexibilidade do sistema.

Considere um sistema de arquivos que implementa a estratégia de **alocação encadeada pura**, onde cada arquivo é representado por uma lista encadeada de blocos de disco, e cada bloco contém um ponteiro para o próximo bloco do arquivo.

Assinale a alternativa correta:

**a)** Esse método elimina completamente a fragmentação interna, uma vez que os blocos de disco podem ser preenchidos byte a byte de forma contínua, independentemente do tamanho padrão do bloco do sistema.

**b)** O acesso aleatório (_direto_) a um bloco específico no meio de um arquivo grande é altamente eficiente, pois o sistema operacional consegue calcular o endereço físico exato do bloco realizando uma operação aritmética simples a partir do bloco inicial.

**c)** A confiabilidade é um ponto forte desse sistema de alocação, pois a perda ou corrupção de um único bloco no meio do arquivo não afeta o acesso aos blocos subsequentes.

**d)** O tamanho útil de armazenamento de dados dentro de cada bloco é ligeiramente menor do que o tamanho físico do bloco de disco, devido ao _overhead_ de espaço necessário para armazenar o ponteiro para o próximo bloco.

**e)** Para contornar o problema do acesso sequencial lento, a alocação encadeada pura exige o uso obrigatório de uma Tabela de Alocação de Arquivos (FAT) residente em memória RAM, descaracterizando o armazenamento de ponteiros dentro dos próprios blocos de disco.

---

## Questão 7 (1,0 ponto)

O subsistema de gerenciamento de arquivos de um sistema operacional é responsável por mapear os arquivos lógicos em blocos físicos de armazenamento secundário (como SSDs ou HDDs).

Entre os métodos clássicos de alocação de espaço, a **alocação indexada** surge como uma solução para os problemas de fragmentação externa da alocação contígua e de acesso sequencial lento da alocação encadeada.

Considere um sistema de arquivos que utiliza **alocação indexada pura** (onde cada arquivo possui um único bloco de índice) com blocos de **4 KB (4096 bytes)**. Sabendo que cada ponteiro de bloco ocupa **4 bytes**, assinale a alternativa correta:

**a)** O tamanho máximo absoluto de um arquivo nesse sistema está limitado a 4 MB e o método sofre severamente com o problema de fragmentação externa no disco quando arquivos grandes são frequentemente deletados.

**b)** O método elimina completamente o desperdício de espaço por fragmentação interna, uma vez que o bloco de índice se ajusta dinamicamente bit a bit ao tamanho exato do arquivo.

**c)** O acesso a qualquer bloco lógico do arquivo exige que o sistema operacional percorra sequencialmente todos os ponteiros anteriores armazenados no bloco de índice, tornando o acesso aleatório tão lento quanto na alocação encadeada.

**d)** Caso um arquivo precise crescer além do limite do bloco de índice único, o sistema operacional é obrigado a realocar fisicamente todo o conteúdo do arquivo para uma nova região contígua do disco através de desfragmentação em tempo de execução.

**e)** O tamanho máximo de um arquivo é de **4 MB (1024 ponteiros × 4 KB)**, e a principal desvantagem do modelo puro é o desperdício de espaço (_overhead_) para arquivos muito pequenos, que gastam um bloco inteiro de 4 KB apenas para armazenar poucos índices.

---

## Questão 8 (2,0 pontos)

Assuma um sistema de arquivos **EXT3** que utiliza **i-nodes** com:

- 10 ponteiros diretos;
- 2 ponteiros indiretos simples;
- 2 ponteiros indiretos duplos;
- 1 ponteiro indireto triplo.

Considerando:

- blocos de **2 KB**;
- ponteiros de **32 bits**;

qual o **tamanho máximo de um arquivo** neste sistema?

Apresente o cálculo detalhado.

---

## Gabarito Resumido

| Questão | Resposta            | Justificativa Resumida                                                                                                                  |
| ------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | **B**               | Endereço físico conhecido em tempo de projeto ⇒ gera-se **código absoluto** na compilação/ligação, sem necessidade de relocação ou MMU. |
| 2       | **C**               | Variável local (`int i`) → **stack**; memória de `malloc()` → **heap**; instruções → **segmento text** (normalmente somente leitura).   |
| 3       | **C**               | Best-fit: P₁→150 KB, P₂→300 KB, P₃→200 KB. Sobra a lacuna de **500 KB** intacta e pequenos fragmentos externos nas demais.              |
| 4a      | **16 KB**           | Tamanho da página = $2^{14}$ bytes = 16384 B = **16 KB**.                                                                               |
| 4b      | **262.144 páginas** | Número de páginas = $2^{18}$.                                                                                                           |
| 4c      | **4 GB**            | Memória máxima = $2^{32}$ bytes = **4 GB**.                                                                                             |
| 5       | **C**               | Linux e o comando `file` identificam o tipo pelo conteúdo (_magic number_), não apenas pela extensão.                                   |
| 6       | **D**               | Na alocação encadeada cada bloco reserva espaço para o ponteiro do próximo bloco.                                                       |
| 7       | **E**               | Bloco de índice: $4096/4 = 1024$ ponteiros; cada ponteiro referencia 4 KB ⇒ $1024 \times 4\text{ KB} = 4\text{ MB}$.                    |
| 8       | **≈ 257 GB**        | Cálculo usando 10 diretos, 2 indiretos simples, 2 duplos e 1 triplo com blocos de 2 KB e ponteiros de 4 bytes.                          |

---

## Questão 8 — Cálculo Detalhado

**Dados:**

- Bloco = 2 KB = 2048 bytes
- Ponteiro = 4 bytes
- Ponteiros por bloco indireto: $2048 / 4 = 512$

### Diretos

$10 \times 2\text{ KB} = 20\text{ KB}$

### Indiretos Simples (2)

$2 \times 512 \times 2\text{ KB} = 2048\text{ KB} = 2\text{ MB}$

### Indiretos Duplos (2)

$2 \times 512^2 \times 2\text{ KB} = 1.048.576\text{ KB} = 1\text{ GB}$

### Indireto Triplo (1)

$512^3 \times 2\text{ KB} = 274.877.906.944\text{ B} = 256\text{ GB}$

### Total

$20\text{ KB} + 2\text{ MB} + 1\text{ GB} + 256\text{ GB} \approx 257.002\text{ GB} \approx 0{,}251\text{ TB}$

> **Correção:** O gabarito original indicava ≈ 1,96 TB, mas como há apenas **1 ponteiro indireto triplo** (e não vários), o resultado correto é aproximadamente **257 GB (0,251 TB)**.
