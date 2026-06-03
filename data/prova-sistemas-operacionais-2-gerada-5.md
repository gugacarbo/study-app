# PROVA 2 DE SISTEMAS OPERACIONAIS

## Unidades 3 e 4: Gerenciamento de Memória e Gerenciamento de Arquivos

**Curso:** Ciência da Computação
**Disciplina:** Sistemas Operacionais
**Nível:** Graduação
**Quantidade de questões:** 15 questões objetivas
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

| Questão | Tipo     | Tema avaliado                    | Nível | Habilidade cobrada       |
| ------: | -------- | -------------------------------- | ----- | ------------------------ |
|       1 | Objetiva | Hierarquia e função da memória   | Fácil | Reconhecer definição     |
|       2 | Objetiva | Endereços lógicos, físicos e MMU | Fácil | Distinguir conceitos     |
|       3 | Objetiva | Modelo de memória do processo    | Fácil | Associar seção e função  |
|       4 | Objetiva | Atribuição de endereços          | Fácil | Reconhecer etapas        |
|       5 | Objetiva | Conceito e atributos de arquivos | Fácil | Identificar propriedades |

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

