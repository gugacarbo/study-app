# PROVA 2 DE SISTEMAS OPERACIONAIS

## Unidades 3 e 4: Gerenciamento de Memória e Gerenciamento de Arquivos

**Curso:** Ciência da Computação
**Disciplina:** Sistemas Operacionais
**Nível:** Graduação
**Quantidade de questões:** 30 questões objetivas
**Instrução geral:** assinale somente uma alternativa correta em cada questão.

---

# PARTE 1: MAPA DA PROVA

## Distribuição de dificuldade

| Nível      | Quantidade | Percentual |
| ---------- | ---------: | ---------: |
| Fácil      |          6 |        20% |
| Média      |         15 |        50% |
| Médio-alta |          9 |        30% |
| **Total**  |     **30** |   **100%** |

## Mapa por questão

| Questão | Tipo     | Tema avaliado                             | Nível      | Habilidade cobrada           |
| ------: | -------- | ----------------------------------------- | ---------- | ---------------------------- |
|       1 | Objetiva | Hierarquia e função da memória            | Fácil      | Reconhecer definição         |
|       2 | Objetiva | Endereços lógicos, físicos e MMU          | Fácil      | Distinguir conceitos         |
|       3 | Objetiva | Modelo de memória do processo             | Fácil      | Associar seção e função      |
|       4 | Objetiva | Atribuição de endereços                   | Fácil      | Reconhecer etapas            |
|       5 | Objetiva | Conceito e atributos de arquivos          | Fácil      | Identificar propriedades     |
|       6 | Objetiva | Diretórios e caminhos                     | Fácil      | Reconhecer organização       |
|       7 | Objetiva | Proteção de memória e troca de contexto   | Média      | Interpretar mecanismo        |
|       8 | Objetiva | Partições fixas e alocação contígua       | Média      | Comparar estratégias         |
|       9 | Objetiva | Realocação em partições fixas             | Média      | Aplicar cálculo              |
|      10 | Objetiva | Registradores base e limite               | Média      | Validar endereço             |
|      11 | Objetiva | Segmentação                               | Média      | Traduzir endereço            |
|      12 | Objetiva | Paginação e divisão de endereço           | Média      | Aplicar relação binária      |
|      13 | Objetiva | Tradução paginada                         | Média      | Interpretar tabela           |
|      14 | Objetiva | Fragmentação e critérios de encaixe       | Média      | Aplicar algoritmo            |
|      15 | Objetiva | Desfragmentação                           | Médio-alta | Analisar custo               |
|      16 | Objetiva | Formatos e arquivos de texto              | Média      | Diferenciar representação    |
|      17 | Objetiva | Executáveis e arquivos especiais          | Média      | Associar abstrações          |
|      18 | Objetiva | Volumes, MBR e VBR                        | Média      | Distinguir estruturas        |
|      19 | Objetiva | Soft links e hard links                   | Média      | Comparar mecanismos          |
|      20 | Objetiva | Montagem de volumes                       | Média      | Interpretar organização      |
|      21 | Objetiva | Camadas do sistema de arquivos            | Médio-alta | Ordenar responsabilidades    |
|      22 | Objetiva | Blocos lógicos e fragmentação interna     | Média      | Aplicar cálculo              |
|      23 | Objetiva | Alocação contígua de arquivos             | Média      | Calcular ocupação            |
|      24 | Objetiva | Alocação encadeada e FAT                  | Médio-alta | Avaliar mecanismo            |
|      25 | Objetiva | Alocação indexada simples                 | Médio-alta | Calcular limite              |
|      26 | Objetiva | Ponteiro indireto simples                 | Médio-alta | Calcular capacidade          |
|      27 | Objetiva | I-node EXT com múltiplas indireções       | Médio-alta | Interpretar cálculo composto |
|      28 | Objetiva | Fragmentação em memória e arquivos        | Médio-alta | Integrar conceitos           |
|      29 | Objetiva | Leitura de arquivo por processo           | Médio-alta | Analisar fluxo técnico       |
|      30 | Objetiva | Integração de alocação em memória e disco | Médio-alta | Resolver cenário composto    |

---

# PARTE 2: PROVA PARA O ALUNO

## Questão 1: Hierarquia de memórias

Sobre os diferentes tipos de memória apresentados no conteúdo, assinale a alternativa correta.

a) A memória RAM é classificada como armazenamento não volátil, destinado principalmente à persistência permanente de arquivos.
b) A cache L1 apresenta maior capacidade e menor velocidade que a memória RAM, pois fica mais distante da CPU.
c) A memória principal funciona como espaço de trabalho do sistema, mantendo processos em execução, estruturas do núcleo e bibliotecas utilizadas durante a execução.
d) Na hierarquia de memórias, quanto mais próximo da base da pirâmide estiver um dispositivo, maior tende a ser sua velocidade e seu custo por byte.
e) Apenas registradores, caches e RAM podem ser considerados memórias; discos e unidades externas não entram nessa classificação.

---

## Questão 2: Endereços lógicos e físicos

Assinale a alternativa correta sobre o acesso à memória durante a execução de processos.

a) Endereços lógicos são produzidos durante a execução do código e podem ser convertidos pela MMU em endereços físicos da memória RAM.
b) Endereços físicos são nomes simbólicos criados pelo compilador para representar variáveis antes da ligação.
c) A MMU é uma biblioteca carregada pelo processo com a função de substituir o compilador na escolha dos endereços.
d) Em sistemas atuais, cada endereço lógico precisa obrigatoriamente coincidir com o endereço físico correspondente.
e) Quando ocorre um acesso inválido, a MMU redireciona silenciosamente o processo para outra região livre da memória.

---

## Questão 3: Seções de memória de um processo

Sobre as seções TEXT, DATA, HEAP e STACK, assinale a alternativa correta.

a) A seção TEXT contém variáveis globais modificáveis e, por isso, deve permitir escrita durante toda a execução.
b) A seção DATA armazena exclusivamente parâmetros e endereços de retorno de funções.
c) A seção STACK é a região utilizada pelos operadores `malloc` e `free` para manter blocos alocados dinamicamente.
d) Em programas com várias threads, todas as threads utilizam obrigatoriamente a mesma pilha principal representada pela seção STACK.
e) A seção HEAP armazena dados obtidos por alocação dinâmica e pode apresentar lacunas entre blocos ocupados ao longo da execução.

---

## Questão 4: Momento de atribuição de endereços

Assinale a alternativa correta sobre as etapas em que endereços podem ser definidos.

a) Durante a carga, o compilador combina bibliotecas e arquivos-objeto para produzir o executável final.
b) Durante a ligação, o ligador combina arquivos-objeto e bibliotecas, resolvendo símbolos para produzir o executável.
c) Durante a execução, o programador escolhe manualmente o endereço físico de cada variável local.
d) O código independente de posição impede que endereços relativos sejam utilizados durante a execução.
e) Bibliotecas dinâmicas somente podem ter seus endereços definidos durante a edição do código-fonte.

---

## Questão 5: Arquivos e atributos

Sobre arquivos e seus atributos, assinale a alternativa correta.

a) Um arquivo é obrigatoriamente um conjunto de registros de tamanho fixo reconhecido diretamente pelo núcleo.
b) O atributo localização informa somente o nome apresentado ao usuário, sem relação com o dispositivo ou posição de armazenamento.
c) Permissões de acesso definem apenas o tamanho máximo do arquivo e não controlam operações de leitura ou escrita.
d) Um arquivo é uma unidade de armazenamento em dispositivo não volátil, podendo possuir atributos como nome, tamanho, proprietário, permissões e localização.
e) Arquivos de texto, imagens e vídeos não podem coexistir em um mesmo sistema de arquivos porque utilizam formatos internos diferentes.

---

## Questão 6: Diretórios e caminhos

Assinale a alternativa correta.

a) Um diretório armazena fisicamente dentro de si todos os bytes de cada arquivo que referencia.
b) Uma referência absoluta sempre parte do diretório de trabalho corrente do processo.
c) Um diretório pode ser implementado como um arquivo estruturado contendo entradas que relacionam nomes a arquivos, subdiretórios ou outros objetos.
d) Em sistemas UNIX, o caractere `\` é obrigatoriamente utilizado como separador de diretórios.
e) A entrada `.` representa o diretório pai, enquanto `..` representa o próprio diretório.

---

## Questão 7: Proteção de memória entre processos

Durante uma troca de contexto, o processador deixa de executar o processo P1 e passa a executar o processo P2. Considerando o papel da MMU, assinale a alternativa correta.

a) A tabela ou regra de tradução de P1 deve continuar ativa para que P2 possa reutilizar livremente as mesmas posições lógicas e físicas.
b) A troca de contexto elimina a necessidade de proteção, pois processos em execução compartilham o mesmo espaço lógico.
c) A MMU passa a converter endereços físicos em instruções de alto nível compatíveis com o processo P2.
d) A proteção ocorre exclusivamente no compilador; após o programa ser carregado, a MMU não participa mais do isolamento.
e) As informações de tradução utilizadas pela MMU precisam ser ajustadas para que o processo P2 acesse apenas as regiões permitidas ao seu espaço de memória.

---

## Questão 8: Estratégias básicas de alocação de memória

Assinale a alternativa correta sobre partições fixas e alocação contígua.

a) Em partições fixas, o número máximo de processos simultaneamente carregados é limitado pelo número de partições, podendo também ocorrer desperdício dentro de uma partição.
b) A alocação contígua elimina completamente a fragmentação externa porque cada processo recebe uma partição ajustada ao seu tamanho.
c) Partições fixas permitem carregar qualquer processo desde que a soma total de memória livre seja suficiente, mesmo que nenhuma partição individual o comporte.
d) Na alocação contígua, cada página lógica pode ser posicionada em qualquer quadro físico não contíguo.
e) A alocação contígua dispensa proteção de limites, pois a posição base já impede acessos externos à partição.

---

## Questão 9: Realocação em partições fixas

Em uma estratégia de partições fixas, um processo ocupa uma partição cujo registrador de realocação contém o valor `110.000`. O processo acessa o endereço lógico `14.257`.

Qual endereço físico deverá ser produzido, caso o acesso seja válido?

a) `95.743`
b) `110.000`
c) `114.257`
d) `124.257`
e) `134.257`

---

## Questão 10: Alocação contígua com base e limite

Um processo utiliza alocação contígua com:

* registrador base = `110.000`;
* registrador limite = `45.000`.

Assinale a alternativa correta.

a) O endereço lógico `45.000` é válido e corresponde ao endereço físico `155.000`.
b) O endereço lógico `44.999` é válido e corresponde ao endereço físico `154.999`, enquanto o endereço lógico `45.000` deve ser rejeitado.
c) O endereço lógico `14.257` deve ser rejeitado porque é inferior ao valor do registrador limite.
d) O endereço lógico máximo válido é `45.000`, pois o limite representa a última posição permitida.
e) O registrador limite deve ser somado ao endereço lógico para determinar o endereço físico, enquanto a base serve apenas para proteção.

---

## Questão 11: Tradução por segmentação

Considere uma tabela de segmentos em que o segmento 4 possui:

* base = `32.300`;
* limite = `8.750`.

Um processo realiza acesso ao endereço lógico `[4:6.914]`.

Assinale a alternativa correta.

a) O acesso é inválido porque todo offset deve ser maior que o limite para alcançar a memória física.
b) O endereço físico produzido é `38.214`, pois o identificador do segmento deve ser subtraído da base.
c) O acesso é válido e resulta no endereço físico `39.214`; o último endereço físico válido desse segmento é `41.049`.
d) O endereço físico produzido é `41.050`, pois o limite deve ser adicionado à base independentemente do offset utilizado.
e) O acesso somente seria válido se todos os segmentos do processo estivessem armazenados de forma contígua na memória física.

---

## Questão 12: Divisão de endereço na paginação

Em um sistema com endereços lógicos de 32 bits e páginas de 4 KB, assinale a alternativa correta.

a) São necessários 4 bits para o offset e 28 bits para identificar a página.
b) São necessários 10 bits para o offset e 22 bits para identificar a página.
c) São necessários 16 bits para o offset e 16 bits para identificar a página.
d) São necessários 20 bits para o offset e 12 bits para identificar a página.
e) São necessários 12 bits para o offset e 20 bits para identificar a página, permitindo endereçar 4 GB.

---

## Questão 13: Tradução de endereço paginado

Em um sistema com páginas de 4 KB, o endereço lógico hexadecimal `0000 5E9A` é dividido em:

* página lógica `0000 5`;
* offset `E9A`.

A tabela de páginas informa que a página lógica `0000 5` está armazenada no quadro físico `2F`.

Qual é o endereço físico resultante?

a) `0000 2FE9`
b) `0002 FE9A`
c) `0005 2FE9`
d) `002F 5E9A`
e) `0000 5E2F`

---

## Questão 14: Fragmentação externa e encaixe

Considere quatro áreas livres de memória:

* A1 = `20 MB`;
* A2 = `8 MB`;
* A3 = `12 MB`;
* A4 = `28 MB`.

Um novo processo solicita `10 MB`.

Assinale a alternativa correta.

a) O first-fit seleciona A1, o best-fit seleciona A3 e o worst-fit seleciona A4.
b) O first-fit seleciona A2, pois é a primeira área cujo tamanho é inferior ao pedido.
c) O best-fit seleciona A4, pois prioriza sempre a maior sobra disponível.
d) O worst-fit seleciona A3, pois busca a menor área que ainda comporte o processo.
e) Nenhuma estratégia pode atender ao pedido, porque não existe uma área livre exatamente igual a `10 MB`.

---

## Questão 15: Custo de desfragmentação

Uma memória apresenta processos separados por lacunas. Três estratégias de compactação produzem uma única região livre contínua suficiente:

* mover P2 e P3: custo total de `60 MB`;
* mover somente P3: custo de `40 MB`;
* mover somente P2: custo de `20 MB`.

Assinale a alternativa correta.

a) A primeira estratégia é obrigatoriamente a melhor, pois mover mais processos sempre reduz o custo de atualização de endereços.
b) A segunda estratégia é a única válida, pois não é possível compactar memória movimentando apenas um processo menor.
c) As três estratégias possuem o mesmo custo efetivo, pois todas resultam na mesma quantidade final de memória livre.
d) Se o objetivo for obter o mesmo resultado com menor volume de dados movimentados, deve-se mover somente P2.
e) A desfragmentação pode ser executada simultaneamente com os processos movimentados, sem atualização das informações de alocação.

---

## Questão 16: Arquivos de texto e formatos internos

Assinale a alternativa correta.

a) Todo arquivo de dados precisa ter seu formato interno integralmente interpretado pelo núcleo antes de ser aberto por uma aplicação.
b) No UNIX, cada final de linha em arquivo de texto utiliza obrigatoriamente a sequência `\r\n`.
c) Em arquivos de texto, o UNIX utiliza `\n` como separador de linhas, enquanto DOS/Windows utiliza a sequência `\r\n`.
d) Arquivos JPEG, PNG e GIF são tratados pelo núcleo como arquivos executáveis, pois possuem formatos padronizados.
e) Arquivos de texto não podem possuir linhas de tamanhos diferentes, pois são organizados obrigatoriamente como registros fixos.

---

## Questão 17: Executáveis e arquivos especiais

Assinale a alternativa correta.

a) O sistema operacional pode representar dispositivos, interfaces do núcleo e canais de comunicação por meio de arquivos especiais, como ocorre com `/dev`, `/proc`, `/sys`, pipes e sockets no contexto UNIX apresentado.
b) Arquivos executáveis contêm apenas código de máquina, não podendo incluir informações sobre símbolos, bibliotecas ou realocação.
c) O formato ELF é utilizado exclusivamente por plataformas Windows, enquanto o PE pertence exclusivamente ao UNIX.
d) Um socket somente pode ser manipulado por acesso direto a setores físicos do disco onde ele foi criado.
e) Diretórios não são reconhecidos pelo núcleo como tipos especiais, pois existem apenas na interface gráfica do usuário.

---

## Questão 18: Organização de volumes

Sobre MBR, VBR, partições e volumes, assinale a alternativa correta.

a) O VBR é a tabela geral de partições do disco e necessariamente ocupa a área anterior a todas as partições.
b) Uma partição somente se torna volume quando recebe um nome de arquivo na raiz do sistema.
c) O MBR existe exclusivamente dentro de cada arquivo armazenado no volume e informa os blocos ocupados por esse arquivo.
d) O boot-loader é armazenado obrigatoriamente na tabela de diretórios de cada usuário.
e) O MBR ocupa uma área inicial do dispositivo e pode conter tabela de partições e código de inicialização; o VBR normalmente aparece no início de uma partição.

---

## Questão 19: Links simbólicos e físicos

Assinale a alternativa correta.

a) Um soft link aponta diretamente para os mesmos blocos físicos do arquivo-alvo e, por isso, continua válido mesmo se o alvo for removido.
b) Um hard link armazena apenas uma string com o caminho do arquivo-alvo e pode atravessar livremente volumes distintos.
c) A remoção de uma das referências físicas elimina imediatamente o conteúdo, mesmo quando ainda existem outros hard links para ele.
d) Um soft link pode referenciar um caminho em outro volume e tornar-se inválido se o alvo for movido ou removido; hard links referenciam o mesmo conteúdo e permanecem restritos ao mesmo sistema de arquivos ou volume.
e) Soft links e hard links são necessariamente cópias completas e independentes dos dados originais.

---

## Questão 20: Montagem de volumes

Assinale a alternativa correta.

a) Montar um volume significa necessariamente copiar todos os seus arquivos para o volume principal antes de permitir qualquer acesso.
b) Em sistemas UNIX, um volume secundário pode ser montado em um diretório da árvore principal, fazendo seu conteúdo aparecer como uma subárvore naquele ponto.
c) A desmontagem preserva obrigatoriamente todas as estruturas de gerenciamento do volume em memória, para impedir o fechamento de arquivos.
d) No Windows, volumes nunca podem ser associados a letras como `C:` ou `D:`.
e) Um pendrive montado em `/media/backup` passa a substituir fisicamente todos os blocos do disco que contém o diretório `/media`.

---

## Questão 21: Camadas do sistema de arquivos

Considere o fluxo de uma operação de leitura feita por um processo. Assinale a alternativa que apresenta corretamente a organização conceitual das camadas, do nível mais próximo da aplicação para o nível mais próximo do hardware.

a) Processo → driver → VFS → controlador → biblioteca de E/S → dispositivo.
b) Biblioteca de E/S → controlador → alocação de arquivos → processo → driver → dispositivo.
c) Processo → gerência de blocos → biblioteca de E/S → VFS → controlador → arquivo.
d) Processo → dispositivo → driver → VFS → alocação de arquivos → controlador.
e) Processo/biblioteca de E/S → chamadas de sistema → VFS → alocação de arquivos → gerência de blocos → driver → controlador/dispositivo.

---

## Questão 22: Blocos lógicos e fragmentação interna

Um sistema de arquivos utiliza blocos lógicos de `4096 bytes`. O arquivo `foto1.jpg` possui `10.417 bytes`.

Assinale a alternativa correta.

a) O arquivo ocupa 2 blocos e desperdiça `1.871 bytes` no último bloco.
b) O arquivo ocupa 3 blocos e desperdiça `2.288 bytes` no último bloco.
c) O arquivo ocupa 3 blocos e desperdiça `1.871 bytes` no último bloco.
d) O arquivo ocupa 4 blocos e desperdiça `5.967 bytes` no último bloco.
e) O arquivo ocupa exatamente 3 blocos sem qualquer desperdício, pois seu tamanho é múltiplo de `4096`.

---

## Questão 23: Alocação contígua de arquivos

Um sistema utiliza blocos de `4096 bytes`. O arquivo `sinfonia.mp3` possui `19.116 bytes` e foi alocado de forma contígua a partir do bloco `24`.

Assinale a alternativa correta.

a) O arquivo necessita de 5 blocos, ocupa os blocos `24` a `28` e deixa `1.364 bytes` não utilizados no último bloco reservado.
b) O arquivo necessita de 4 blocos, ocupa os blocos `24` a `27` e deixa `2.732 bytes` não utilizados.
c) O arquivo necessita de 5 blocos, mas ocupa obrigatoriamente os blocos `24`, `26`, `28`, `30` e `32`.
d) O arquivo necessita de 6 blocos, porque a alocação contígua reserva sempre um bloco adicional para indicar o fim do arquivo.
e) O arquivo não pode ser alocado de forma contígua, pois arquivos de áudio exigem alocação indexada.

---

## Questão 24: Alocação encadeada e FAT

Assinale a alternativa correta.

a) Na alocação encadeada, todos os blocos de um arquivo precisam ser consecutivos para que os ponteiros funcionem.
b) A alocação encadeada melhora o acesso direto aleatório, pois o bloco intermediário pode ser localizado sem percorrer referências anteriores.
c) Na FAT, cada arquivo possui obrigatoriamente um i-node separado com ponteiros diretos, indiretos simples, duplos e triplos.
d) Na FAT, os encadeamentos entre blocos são mantidos em uma tabela separada; uma entrada pode indicar o próximo bloco, fim do arquivo, bloco livre, reservado ou defeituoso.
e) A FAT elimina qualquer risco decorrente de defeitos nos metadados, pois seus ponteiros nunca precisam ser consultados durante a leitura.

---

## Questão 25: Limite de arquivo em índice simples

Um sistema utiliza alocação indexada com:

* blocos de `4 KB`;
* um índice com `64` entradas;
* cada entrada apontando diretamente para um bloco de dados.

Qual é o tamanho máximo de arquivo representável por esse índice?

a) `64 KB`
b) `256 KB`
c) `512 KB`
d) `1024 KB`
e) `4096 KB`

---

## Questão 26: Ponteiro indireto simples

Em um sistema com blocos de `4096 bytes` e ponteiros de `32 bits`, assinale a alternativa correta.

a) Cada ponteiro ocupa `32 bytes`, permitindo apenas `128` ponteiros por bloco indireto.
b) Cada bloco indireto comporta `256` ponteiros, pois `4096 / 16 = 256`.
c) Cada bloco indireto comporta `4096` ponteiros, pois cada byte pode representar diretamente um bloco.
d) Um ponteiro indireto simples alcança no máximo `1024 bytes` adicionais de conteúdo.
e) Cada bloco indireto comporta `1024` ponteiros, podendo referenciar `1024 × 4096 = 4.194.304 bytes` de dados.

---

## Questão 27: Limite de arquivo em i-node EXT

Considere um i-node com:

* 12 ponteiros diretos;
* 1 ponteiro indireto simples;
* 1 ponteiro duplamente indireto;
* 1 ponteiro triplamente indireto;
* blocos de `4096 bytes`;
* ponteiros de `4 bytes`.

Qual alternativa apresenta corretamente o tamanho máximo aproximado do arquivo calculado segundo esse modelo?

a) Aproximadamente `256 KB`, porque apenas os ponteiros diretos contam para os dados.
b) Aproximadamente `4 MB`, porque o ponteiro indireto simples substitui todos os demais níveis.
c) `4.402.345.721.856 bytes`, aproximadamente `4 TB`.
d) `4.294.967.296 bytes`, exatamente `4 GB`, pois qualquer i-node é limitado a endereços de 32 bits.
e) Aproximadamente `16 TB`, porque cada nível indireto multiplica obrigatoriamente o total final por quatro.

---

## Questão 28: Fragmentação em memória e em arquivos

Assinale a alternativa correta.

a) A paginação de processos apresenta fragmentação externa porque páginas de tamanhos diferentes deixam lacunas variáveis entre quadros.
b) A alocação contígua de arquivos elimina fragmentação externa, pois arquivos sempre podem crescer ocupando qualquer bloco livre do disco.
c) A fragmentação interna de arquivos ocorre somente quando os blocos são defeituosos e deixam de armazenar dados úteis.
d) A paginação evita fragmentação externa na alocação de memória apresentada, enquanto blocos lógicos grandes em arquivos podem desperdiçar parte do último bloco reservado, produzindo fragmentação interna.
e) Segmentação e alocação contígua são imunes à fragmentação externa porque usam registradores de limite.

---

## Questão 29: Fluxo de leitura de arquivo por um processo

Um processo executa as seguintes ações:

1. aloca dinamicamente um buffer;
2. abre um arquivo armazenado em disco;
3. solicita a leitura de parte do conteúdo para o buffer.

Assinale a alternativa correta.

a) O buffer deve obrigatoriamente ser armazenado na seção TEXT, pois receberá bytes provenientes de um arquivo.
b) O buffer pode estar no HEAP; a solicitação de leitura passa pela interface de arquivos do sistema, e as camadas inferiores realizam o acesso aos blocos do dispositivo por meio dos drivers e controladores.
c) A operação de leitura dispensa o VFS e a gerência de blocos, pois arquivos abertos são transferidos diretamente do disco para a pilha do processo pelo compilador.
d) O arquivo precisa ser integralmente copiado para a seção DATA do processo no instante da compilação para depois ser lido.
e) A MMU substitui o sistema de arquivos na localização dos blocos físicos do arquivo, pois ambos realizam exatamente o mesmo tipo de mapeamento.

---

## Questão 30: Integração entre alocação de memória e arquivos

Considere simultaneamente os seguintes cenários:

**Memória:** existem áreas livres de `20 MB`, `8 MB`, `12 MB` e `28 MB`. Um processo solicita `18 MB`, e o sistema utiliza o algoritmo worst-fit.

**Arquivo:** o mesmo processo grava um arquivo de `6.214 bytes` em um sistema de arquivos com blocos de `4096 bytes`.

Assinale a alternativa correta.

a) O worst-fit seleciona a área de `28 MB`, deixando uma sobra de `10 MB`; o arquivo ocupa 2 blocos e deixa `1.978 bytes` não utilizados no último bloco.
b) O worst-fit seleciona a área de `20 MB`, deixando uma sobra de `2 MB`; o arquivo ocupa 1 bloco, pois possui menos de `8192 bytes`.
c) O worst-fit seleciona a área de `12 MB`, pois ela produz a menor fragmentação; o arquivo ocupa 2 blocos sem desperdício.
d) O worst-fit não consegue alocar o processo, pois nenhuma área livre possui exatamente `18 MB`; o arquivo ocupa 3 blocos.
e) O worst-fit seleciona a área de `28 MB`, deixando sobra de `18 MB`; o arquivo ocupa 2 blocos e desperdiça `2.214 bytes`.

---

# PARTE 3: GABARITO OBJETIVO

## Observação sobre o formato

Como esta avaliação foi solicitada integralmente em formato de múltipla escolha com alternativas **a–e**, não há gabarito por somatória de valores. O gabarito correspondente é apresentado por alternativa correta.

| Questão | Resposta | Questão | Resposta | Questão | Resposta |
| ------: | :------: | ------: | :------: | ------: | :------: |
|       1 |    C     |      11 |    C     |      21 |    E     |
|       2 |    A     |      12 |    E     |      22 |    C     |
|       3 |    E     |      13 |    B     |      23 |    A     |
|       4 |    B     |      14 |    A     |      24 |    D     |
|       5 |    D     |      15 |    D     |      25 |    B     |
|       6 |    C     |      16 |    C     |      26 |    E     |
|       7 |    E     |      17 |    A     |      27 |    C     |
|       8 |    A     |      18 |    E     |      28 |    D     |
|       9 |    D     |      19 |    D     |      29 |    B     |
|      10 |    B     |      20 |    B     |      30 |    A     |

## Distribuição das respostas corretas

| Alternativa | Quantidade de respostas corretas |
| :---------: | -------------------------------: |
|      A      |                                6 |
|      B      |                                6 |
|      C      |                                6 |
|      D      |                                6 |
|      E      |                                6 |

---

# PARTE 4: CORREÇÃO COMENTADA DAS ALTERNATIVAS

## Questão 1

**Resposta correta: C**

* **a) Incorreta.** A RAM é memória principal e volátil; arquivos persistentes são mantidos em dispositivos não voláteis.
* **b) Incorreta.** A cache L1 é menor e mais rápida que a RAM, não maior e mais lenta.
* **c) Correta.** A memória principal mantém processos, estruturas do núcleo, bibliotecas e demais dados necessários à execução.
* **d) Incorreta.** Ao descer na hierarquia, tende a aumentar a capacidade e diminuir a velocidade e o custo por byte.
* **e) Incorreta.** O material considera, em sentido amplo, discos e unidades externas como formas de memória ou armazenamento.

## Questão 2

**Resposta correta: A**

* **a) Correta.** O processador produz endereços lógicos, e a MMU pode convertê-los em endereços físicos.
* **b) Incorreta.** Endereços físicos correspondem a posições reais da memória, não a símbolos de compilação.
* **c) Incorreta.** A MMU é um componente de hardware, não uma biblioteca do processo.
* **d) Incorreta.** A existência da MMU permite que endereços lógicos sejam diferentes dos físicos.
* **e) Incorreta.** Um acesso inválido produz interrupção ou exceção, não realocação silenciosa.

## Questão 3

**Resposta correta: E**

* **a) Incorreta.** TEXT contém código e normalmente permite leitura e execução, não escrita.
* **b) Incorreta.** DATA contém dados estáticos, como variáveis globais e locais estáticas.
* **c) Incorreta.** `malloc` e `free` operam sobre o HEAP, não sobre a STACK.
* **d) Incorreta.** Threads adicionais possuem suas próprias pilhas.
* **e) Correta.** O HEAP armazena memória dinâmica e pode apresentar fragmentação entre blocos alocados.

## Questão 4

**Resposta correta: B**

* **a) Incorreta.** A combinação de arquivos-objeto e bibliotecas é função do ligador, não da etapa de carga.
* **b) Correta.** O ligador resolve símbolos e produz o executável a partir de objetos e bibliotecas.
* **c) Incorreta.** Durante a execução, a tradução normalmente é realizada por hardware, não por escolha manual do programador.
* **d) Incorreta.** O código independente de posição utiliza justamente referências relativas.
* **e) Incorreta.** Bibliotecas dinâmicas podem ter endereços definidos durante a carga.

## Questão 5

**Resposta correta: D**

* **a) Incorreta.** Um arquivo pode ser tratado simplesmente como sequência de bytes.
* **b) Incorreta.** Localização indica dispositivo e posição interna de armazenamento.
* **c) Incorreta.** Permissões regulam operações como leitura, escrita e execução.
* **d) Correta.** A alternativa reúne corretamente conceito e atributos comuns de arquivos.
* **e) Incorreta.** Um mesmo sistema de arquivos pode armazenar arquivos de formatos diversos.

## Questão 6

**Resposta correta: C**

* **a) Incorreta.** Diretórios mantêm referências, não os bytes internos de todos os conteúdos referenciados.
* **b) Incorreta.** Caminho absoluto parte da raiz; caminho relativo parte do diretório de trabalho.
* **c) Correta.** Diretórios podem ser implementados como arquivos estruturados contendo entradas.
* **d) Incorreta.** O separador típico no UNIX é `/`.
* **e) Incorreta.** `.` representa o próprio diretório e `..` representa o diretório pai.

## Questão 7

**Resposta correta: E**

* **a) Incorreta.** Manter a tradução de P1 para P2 violaria o isolamento entre processos.
* **b) Incorreta.** Processos possuem espaços protegidos, ainda que coexistam na memória.
* **c) Incorreta.** A MMU traduz endereços; não converte instruções em linguagem de alto nível.
* **d) Incorreta.** A MMU participa da proteção durante a execução.
* **e) Correta.** A troca de contexto exige atualização das informações usadas para traduzir e proteger o espaço do processo corrente.

## Questão 8

**Resposta correta: A**

* **a) Correta.** Partições fixas limitam a quantidade de processos carregados e podem desperdiçar espaço interno.
* **b) Incorreta.** A alocação contígua é sujeita à fragmentação externa.
* **c) Incorreta.** Um processo precisa caber em uma partição individual.
* **d) Incorreta.** A alternativa descreve paginação, não alocação contígua.
* **e) Incorreta.** A proteção exige verificar se o endereço lógico está dentro do limite permitido.

## Questão 9

**Resposta correta: D**

Cálculo:

`110.000 + 14.257 = 124.257`

* **a) Incorreta.** Corresponde a uma subtração inexistente no mecanismo apresentado.
* **b) Incorreta.** Considera apenas a base, ignorando o endereço lógico.
* **c) Incorreta.** Soma apenas parte do deslocamento necessário.
* **d) Correta.** O endereço físico é a soma entre realocação e endereço lógico.
* **e) Incorreta.** Produz valor superior ao resultado da soma correta.

## Questão 10

**Resposta correta: B**

A faixa válida é de `110.000` até `154.999`, pois:

`110.000 + 45.000 - 1 = 154.999`

* **a) Incorreta.** Um endereço lógico igual ao limite já deve ser rejeitado.
* **b) Correta.** `44.999` é o último offset válido, e `45.000` está fora da partição.
* **c) Incorreta.** Endereços inferiores ao limite são permitidos.
* **d) Incorreta.** O limite representa o tamanho, não o último offset válido.
* **e) Incorreta.** A base é somada ao endereço lógico; o limite é usado na validação.

## Questão 11

**Resposta correta: C**

Cálculos:

`32.300 + 6.914 = 39.214`

`32.300 + 8.750 - 1 = 41.049`

* **a) Incorreta.** Um offset válido deve ser menor que o limite.
* **b) Incorreta.** O cálculo não envolve subtrair o número do segmento.
* **c) Correta.** Apresenta corretamente a tradução e o último endereço permitido.
* **d) Incorreta.** Confunde limite do segmento com endereço efetivamente acessado.
* **e) Incorreta.** Segmentos podem ser posicionados separadamente na memória física.

## Questão 12

**Resposta correta: E**

Como `4 KB = 4096 bytes = 2¹²`, são necessários 12 bits para o offset. Restam 20 bits para o número da página.

* **a) Incorreta.** Quatro bits representariam apenas 16 posições internas.
* **b) Incorreta.** Dez bits permitiriam páginas de apenas 1024 bytes.
* **c) Incorreta.** Dezesseis bits indicariam páginas de 64 KB.
* **d) Incorreta.** Inverte os campos de página e offset.
* **e) Correta.** A divisão 20/12 permite alcançar `2³²` bytes, equivalentes a 4 GB.

## Questão 13

**Resposta correta: B**

O offset permanece `E9A`, enquanto o número da página lógica é substituído pelo quadro físico `2F`.

* **a) Incorreta.** Apresenta montagem incompleta e deslocada.
* **b) Correta.** O endereço físico formado é `0002 FE9A`.
* **c) Incorreta.** Mantém indevidamente o número da página lógica.
* **d) Incorreta.** Combina quadro e endereço lógico completo sem preservar a estrutura correta.
* **e) Incorreta.** Apenas concatena campos em ordem incorreta.

## Questão 14

**Resposta correta: A**

* **a) Correta.** First-fit escolhe a primeira área suficiente, A1; best-fit escolhe a menor suficiente, A3; worst-fit escolhe a maior, A4.
* **b) Incorreta.** A2 possui apenas 8 MB e não comporta o pedido de 10 MB.
* **c) Incorreta.** Best-fit procura a menor área adequada, não a maior.
* **d) Incorreta.** Worst-fit escolhe a maior área disponível.
* **e) Incorreta.** A área livre não precisa ter tamanho exatamente igual ao pedido.

## Questão 15

**Resposta correta: D**

* **a) Incorreta.** Mover mais processos aumenta, neste cenário, o volume deslocado.
* **b) Incorreta.** O próprio cenário informa que mover apenas P2 também gera a compactação desejada.
* **c) Incorreta.** O resultado espacial pode ser igual, mas o custo de movimentação é diferente.
* **d) Correta.** Mover somente P2 custa 20 MB, menor valor entre as soluções.
* **e) Incorreta.** A desfragmentação exige atualização das informações de alocação e interrupção da execução durante a movimentação.

## Questão 16

**Resposta correta: C**

* **a) Incorreta.** O núcleo geralmente trata muitos arquivos apenas como sequências de bytes.
* **b) Incorreta.** No UNIX, o separador de linha apresentado é `\n`.
* **c) Correta.** UNIX utiliza `\n`, enquanto DOS/Windows utiliza `\r\n`.
* **d) Incorreta.** Arquivos de imagem não se tornam executáveis por possuírem formatos reconhecíveis.
* **e) Incorreta.** Arquivos de texto podem possuir linhas de tamanhos variáveis.

## Questão 17

**Resposta correta: A**

* **a) Correta.** O conteúdo apresenta dispositivos, interfaces do núcleo e canais de comunicação como arquivos especiais.
* **b) Incorreta.** Executáveis podem conter código, símbolos, dependências e informações de realocação.
* **c) Incorreta.** ELF é associado a plataformas UNIX modernas e PE a plataformas Windows.
* **d) Incorreta.** Socket é abstração de comunicação, não arquivo gravado em setores para acesso direto.
* **e) Incorreta.** Diretórios são objetos reconhecidos e gerenciados pelo sistema de arquivos.

## Questão 18

**Resposta correta: E**

* **a) Incorreta.** A descrição corresponde ao MBR, não ao VBR.
* **b) Incorreta.** Um volume resulta da preparação e formatação da partição para conter um sistema de arquivos.
* **c) Incorreta.** O MBR pertence à organização inicial do dispositivo, não ao interior de cada arquivo.
* **d) Incorreta.** O boot-loader não depende de diretórios individuais de usuários.
* **e) Correta.** A alternativa diferencia adequadamente MBR e VBR.

## Questão 19

**Resposta correta: D**

* **a) Incorreta.** Soft links armazenam caminhos e podem quebrar se o alvo for removido.
* **b) Incorreta.** A descrição dada corresponde ao soft link, não ao hard link.
* **c) Incorreta.** O conteúdo somente deve ser removido quando não restarem referências físicas.
* **d) Correta.** A alternativa identifica corretamente o comportamento e a restrição de cada tipo de link.
* **e) Incorreta.** Links evitam a duplicação integral dos dados.

## Questão 20

**Resposta correta: B**

* **a) Incorreta.** Montagem não exige copiar os arquivos para o volume principal.
* **b) Correta.** Em UNIX, volumes podem ser inseridos na árvore principal por meio de pontos de montagem.
* **c) Incorreta.** A desmontagem remove estruturas de gerenciamento após encerrar acessos pendentes.
* **d) Incorreta.** Letras de unidades são formas tradicionais de identificação de volumes no Windows.
* **e) Incorreta.** O volume montado passa a ser acessível naquele ponto lógico, sem substituir fisicamente o disco principal.

## Questão 21

**Resposta correta: E**

* **a) Incorreta.** O driver não vem imediatamente após o processo, e o VFS não fica abaixo do controlador.
* **b) Incorreta.** O processo não aparece depois da camada de alocação; ele origina a requisição.
* **c) Incorreta.** A biblioteca de E/S deve anteceder as chamadas ao núcleo.
* **d) Incorreta.** O processo não acessa diretamente o dispositivo antes das camadas do núcleo.
* **e) Correta.** Representa corretamente o fluxo abstrato da aplicação até o hardware.

## Questão 22

**Resposta correta: C**

Cálculo:

`3 × 4096 = 12.288 bytes`

`12.288 - 10.417 = 1.871 bytes`

* **a) Incorreta.** Dois blocos comportariam apenas 8192 bytes.
* **b) Incorreta.** A quantidade de blocos está correta, mas o desperdício foi calculado incorretamente.
* **c) Correta.** São necessários 3 blocos, com 1871 bytes não utilizados.
* **d) Incorreta.** Quatro blocos não são necessários para esse tamanho.
* **e) Incorreta.** O tamanho do arquivo não é múltiplo exato do bloco.

## Questão 23

**Resposta correta: A**

Cálculo:

`5 × 4096 = 20.480 bytes`

`20.480 - 19.116 = 1.364 bytes`

* **a) Correta.** Cinco blocos consecutivos a partir do bloco 24 ocupam a faixa 24 a 28.
* **b) Incorreta.** Quatro blocos armazenariam apenas 16.384 bytes.
* **c) Incorreta.** A sequência indicada não é contígua.
* **d) Incorreta.** A alocação contígua não reserva automaticamente um bloco adicional para indicar fim.
* **e) Incorreta.** O tipo de conteúdo não impede a utilização da estratégia.

## Questão 24

**Resposta correta: D**

* **a) Incorreta.** A alocação encadeada permite blocos espalhados pelo disco.
* **b) Incorreta.** O acesso direto é prejudicado porque pode exigir percorrer a cadeia.
* **c) Incorreta.** A descrição corresponde ao modelo de i-nodes, não à FAT.
* **d) Correta.** A FAT mantém os encadeamentos em tabela separada e utiliza marcas especiais para estados dos blocos.
* **e) Incorreta.** Defeitos em estruturas de metadados podem comprometer o acesso à cadeia de dados.

## Questão 25

**Resposta correta: B**

Cálculo:

`64 × 4 KB = 256 KB`

* **a) Incorreta.** Considera incorretamente apenas 1 KB por entrada.
* **b) Correta.** Sessenta e quatro blocos de 4 KB totalizam 256 KB.
* **c) Incorreta.** Corresponderia a 128 blocos de 4 KB.
* **d) Incorreta.** Corresponderia a 256 blocos de 4 KB.
* **e) Incorreta.** Corresponderia a 1024 blocos de 4 KB.

## Questão 26

**Resposta correta: E**

Cálculos:

`32 bits = 4 bytes`

`4096 / 4 = 1024 ponteiros`

`1024 × 4096 = 4.194.304 bytes`

* **a) Incorreta.** Confunde bits com bytes.
* **b) Incorreta.** Utiliza tamanho de ponteiro não previsto no cenário.
* **c) Incorreta.** Um ponteiro ocupa 4 bytes, não 1 byte.
* **d) Incorreta.** O limite corresponde a milhões de bytes de dados, não a 1024 bytes.
* **e) Correta.** Apresenta corretamente a quantidade de ponteiros e a capacidade referenciada.

## Questão 27

**Resposta correta: C**

Cálculo:

`4096 × (12 + 1024 + 1024² + 1024³)`

`= 4.402.345.721.856 bytes`

* **a) Incorreta.** Ignora todos os níveis indiretos.
* **b) Incorreta.** Considera apenas parte da estrutura.
* **c) Correta.** É o resultado obtido com os ponteiros diretos, simples, duplos e triplos.
* **d) Incorreta.** O número de ponteiros alcançáveis permite superar 4 GB nesse modelo.
* **e) Incorreta.** O valor apresentado não corresponde ao cálculo estabelecido.

## Questão 28

**Resposta correta: D**

* **a) Incorreta.** Na paginação apresentada, páginas e quadros possuem tamanho fixo, evitando fragmentação externa.
* **b) Incorreta.** A alocação contígua de arquivos sofre com fragmentação externa e dificuldade de crescimento.
* **c) Incorreta.** Fragmentação interna decorre de espaço não utilizado dentro de blocos reservados.
* **d) Correta.** A alternativa distingue adequadamente fragmentação externa em memória e interna em blocos de arquivos.
* **e) Incorreta.** Segmentação e alocação contígua continuam sujeitas a buracos externos.

## Questão 29

**Resposta correta: B**

* **a) Incorreta.** Dados alocados dinamicamente ficam no HEAP, não na seção de código.
* **b) Correta.** A alternativa relaciona corretamente HEAP, interface de arquivos, blocos, drivers e controladores.
* **c) Incorreta.** Leitura de arquivos depende das camadas de sistema de arquivos e não é realizada pelo compilador.
* **d) Incorreta.** O arquivo é lido em execução; não precisa ser incorporado ao processo na compilação.
* **e) Incorreta.** MMU trata mapeamento de memória; sistema de arquivos trata localização persistente de dados em armazenamento.

## Questão 30

**Resposta correta: A**

Cálculos da memória:

* Worst-fit escolhe a maior área: `28 MB`.
* Sobra: `28 - 18 = 10 MB`.

Cálculos do arquivo:

* `2 × 4096 = 8192 bytes`.

* `8192 - 6214 = 1978 bytes`.

* **a) Correta.** Apresenta corretamente a escolha do worst-fit e a ocupação do arquivo em blocos.

* **b) Incorreta.** Worst-fit escolhe a maior área disponível, não a de 20 MB; além disso, um bloco é insuficiente.

* **c) Incorreta.** A área de 12 MB não comporta o processo.

* **d) Incorreta.** Não é necessário que exista uma área exatamente igual ao pedido.

* **e) Incorreta.** A sobra na memória e o desperdício no arquivo foram calculados incorretamente.

---

# PARTE 5: RESPOSTA ESPERADA DAS DISCURSIVAS

Não se aplica a esta versão da avaliação.

A estrutura original do modelo previa questões discursivas e questões de somatória. Contudo, nesta prova foi adotada a configuração específica solicitada: **30 questões objetivas de múltipla escolha com alternativas a–e**.

---

# PARTE 6: AUDITORIA FINAL DA PROVA

| Verificação                                                | Resultado                                                                                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Todas as questões cobram apenas o conteúdo fornecido?      | **Sim.** Foram utilizados exclusivamente conceitos, relações e cálculos derivados das Unidades 3 e 4.                                                           |
| As afirmações possuem resposta inequívoca?                 | **Sim.** Cada questão possui somente uma alternativa correta e as incorretas apresentam erro técnico identificável.                                             |
| Os cálculos foram conferidos?                              | **Sim.** Foram revisados os cálculos de realocação, segmentação, paginação, fragmentação, ocupação em blocos e capacidade de i-nodes.                           |
| Há equilíbrio entre dificuldade fácil, média e médio-alta? | **Sim.** Foram elaboradas 6 questões fáceis, 15 médias e 9 médio-altas.                                                                                         |
| A prova progride do conceito básico à aplicação técnica?   | **Sim.** As primeiras questões tratam de fundamentos; as finais integram mecanismos e cálculos.                                                                 |
| Há mistura de erros sutis plausíveis?                      | **Sim.** Foram usados troca de classificação, inversão de função, limite deslocado, cálculo incorreto, etapa errada e aplicação indevida de conceito.           |
| Há questões dependentes de conteúdo externo ao material?   | **Não.** A pesquisa externa foi utilizada apenas para validação técnica, não para adicionar tópicos cobrados.                                                   |
| Há alternativas potencialmente ambíguas ou controversas?   | **Nenhuma identificada após revisão.** Foram evitados pontos laterais do material que poderiam exigir contextualização histórica ou de implementação adicional. |
| Há repetição literal de questões anteriores?               | **Não.** A prova é inédita e apenas reproduz o padrão de dificuldade e formulação solicitado.                                                                   |
| O gabarito está balanceado entre as letras?                | **Sim.** Cada alternativa aparece exatamente 6 vezes como resposta correta.                                                                                     |

## Conferência dos principais cálculos

| Questão | Operação conferida                   |                 Resultado |
| ------: | ------------------------------------ | ------------------------: |
|       9 | `110.000 + 14.257`                   |                 `124.257` |
|      10 | `110.000 + 45.000 - 1`               |                 `154.999` |
|      11 | `32.300 + 6.914`                     |                  `39.214` |
|      11 | `32.300 + 8.750 - 1`                 |                  `41.049` |
|      12 | `2¹²`                                |              `4096 bytes` |
|      14 | `20 + 8 + 12 + 28`                   |            `68 MB livres` |
|      22 | `3 × 4096 - 10.417`                  |             `1.871 bytes` |
|      23 | `5 × 4096 - 19.116`                  |             `1.364 bytes` |
|      25 | `64 × 4096`                          |  `262.144 bytes = 256 KB` |
|      26 | `4096 / 4`                           |          `1024 ponteiros` |
|      26 | `1024 × 4096`                        |         `4.194.304 bytes` |
|      27 | `4096 × (12 + 1024 + 1024² + 1024³)` | `4.402.345.721.856 bytes` |
|      30 | `28 - 18`                            |                   `10 MB` |
|      30 | `2 × 4096 - 6214`                    |             `1.978 bytes` |

---

**Fim da avaliação.**
