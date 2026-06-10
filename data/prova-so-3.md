Usei o texto consolidado fornecido como limite de conteúdo da avaliação. A pesquisa externa foi usada apenas para conferência técnica: a documentação do kernel Linux confirma E/S mapeada em memória e o carregamento de `initrd`; o manual do GNU GRUB confirma o papel do bootloader em carregar o kernel e transferir-lhe o controle. ([Linux Kernel Archives][1])

**Adaptação de formato:** como você solicitou explicitamente **30 questões, todas de múltipla escolha a–e**, a prova abaixo utiliza alternativa única correta em cada questão. Assim, “gabarito de somatória” foi substituído por **gabarito objetivo**, e a seção de respostas discursivas consta como **não aplicável**.

# Avaliação de Sistemas Operacionais

## Unidades 5 e 6: Gerenciamento de Entrada/Saída e Inicialização por Bootloader

**Curso:** Ciência da Computação
**Disciplina:** Sistemas Operacionais
**Conteúdos avaliados:** Gerenciamento de entrada e saída; modos de acesso a dispositivos; interfaces de E/S; bloqueio; buffering; caching; spooling; desenvolvimento de sistemas operacionais; kernel e microkernel; bootloader; inicialização Linux; BIOS/MBR; EFI/UEFI; GRUB.
**Quantidade de questões:** 30 questões objetivas de múltipla escolha, com alternativas de **a** a **e**.
**Instrução geral:** assinale apenas uma alternativa em cada questão.

---

# PARTE 1 — Mapa da prova

| Questão | Tipo     | Tema avaliado                         | Dificuldade | Habilidade cobrada                    |
| ------: | -------- | ------------------------------------- | ----------- | ------------------------------------- |
|       1 | Objetiva | Conceito de entrada e saída           | Fácil       | Reconhecer definição                  |
|       2 | Objetiva | Dispositivos e drivers                | Fácil       | Associar conceito e função            |
|       3 | Objetiva | Barramentos                           | Fácil       | Reconhecer função estrutural          |
|       4 | Objetiva | Classificação de dispositivos         | Fácil       | Identificar categorias                |
|       5 | Objetiva | Formas gerais de acesso à E/S         | Fácil       | Reconhecer mecanismos                 |
|       6 | Objetiva | Kernel e microkernel                  | Fácil       | Distinguir definições básicas         |
|       7 | Objetiva | E/S em porta                          | Média       | Interpretar mecanismo                 |
|       8 | Objetiva | Código Assembly com porta paralela    | Média       | Interpretar procedimento              |
|       9 | Objetiva | E/S mapeada em memória                | Média       | Distinguir mecanismos                 |
|      10 | Objetiva | Endereços da impressora mapeada       | Média       | Interpretar código e função           |
|      11 | Objetiva | DMA                                   | Média       | Relacionar mecanismo e finalidade     |
|      12 | Objetiva | Comparação entre porta, MMIO e DMA    | Média       | Comparar soluções                     |
|      13 | Objetiva | Interfaces e classificações de E/S    | Média       | Associar dispositivo e característica |
|      14 | Objetiva | Drivers e `ioctl()`                   | Média       | Interpretar interface privilegiada    |
|      15 | Objetiva | Socket e serviços de tempo            | Média       | Reconhecer interfaces de aplicação    |
|      16 | Objetiva | E/S bloqueante                        | Média       | Interpretar estados de processo       |
|      17 | Objetiva | E/S assíncrona e threads              | Média       | Analisar concorrência                 |
|      18 | Objetiva | Buffering                             | Média       | Distinguir finalidade                 |
|      19 | Objetiva | Double buffering                      | Média       | Aplicar conceito                      |
|      20 | Objetiva | Caching e spooling                    | Média       | Diferenciar conceitos próximos        |
|      21 | Objetiva | Linguagens e desenvolvimento de SO    | Média       | Identificar associações               |
|      22 | Objetiva | Seleção de mecanismo de E/S           | Médio-alta  | Analisar cenário técnico              |
|      23 | Objetiva | Buffer, cache e spool integrados      | Médio-alta  | Diferenciar aplicações                |
|      24 | Objetiva | Conceito de bootloader                | Médio-alta  | Interpretar função no sistema         |
|      25 | Objetiva | Kernel e disco RAM inicial            | Médio-alta  | Interpretar sequência de boot         |
|      26 | Objetiva | BIOS/MBR                              | Médio-alta  | Ordenar procedimento                  |
|      27 | Objetiva | EFI/UEFI                              | Médio-alta  | Diferenciar métodos de boot           |
|      28 | Objetiva | Segundo estágio e GRUB                | Médio-alta  | Interpretar transferência de controle |
|      29 | Objetiva | Fluxo completo de inicialização Linux | Médio-alta  | Ordenar etapas                        |
|      30 | Objetiva | Integração entre boot, drivers e E/S  | Médio-alta  | Analisar mecanismo integrado          |

**Distribuição de dificuldade**

| Nível      | Quantidade | Percentual |
| ---------- | ---------: | ---------: |
| Fácil      |          6 |        20% |
| Média      |         15 |        50% |
| Médio-alta |          9 |        30% |

---

# PARTE 2 — Prova para o aluno

## Questão 1 — Conceito de entrada e saída

Em relação às operações de entrada e saída em um sistema computacional, assinale a alternativa correta.

a) Operações de entrada e saída são utilizadas apenas por processos que interagem diretamente com o usuário.
b) Operações de entrada e saída permitem que processos recebam dados de dispositivos ou apresentem resultados a outros componentes ou usuários.
c) Entrada e saída referem-se exclusivamente à transferência de dados entre processador e memória cache.
d) Dispositivos de armazenamento não são considerados dispositivos de entrada e saída, pois não interagem diretamente com pessoas.
e) O sistema operacional não participa de operações de E/S quando o dispositivo está conectado por comunicação sem fio.

---

## Questão 2 — Drivers de dispositivo

Assinale a alternativa que descreve corretamente a função de um driver de dispositivo.

a) Substituir fisicamente o controlador de hardware sempre que um novo dispositivo for conectado.
b) Permitir que o sistema operacional saiba como controlar e se comunicar com determinado dispositivo.
c) Eliminar a necessidade de barramentos entre processador, memória e periféricos.
d) Executar exclusivamente como aplicação de usuário, sem relação com o kernel.
e) Servir apenas para dispositivos de armazenamento, não sendo empregado em teclado, rede ou vídeo.

---

## Questão 3 — Barramentos

Sobre os barramentos empregados na comunicação interna do computador, assinale a alternativa correta.

a) São regiões de armazenamento temporário destinadas a manter cópias de dados frequentemente acessados.
b) São mecanismos de software utilizados apenas pelo bootloader durante a inicialização.
c) São conjuntos de trilhas eletrônicas usados para transmissão de informações entre componentes, possuindo protocolos e características próprias.
d) São drivers responsáveis por converter operações de escrita em operações de leitura.
e) São utilizados somente para comunicação entre dispositivos externos sem fio.

---

## Questão 4 — Classificação geral dos dispositivos

De acordo com a classificação apresentada para dispositivos de entrada e saída, assinale a alternativa correta.

a) Discos pertencem exclusivamente à categoria de dispositivos de interface com o usuário.
b) Adaptadores de rede não são dispositivos de E/S, pois operam apenas com comunicação remota.
c) Teclados e mouses podem ser classificados como dispositivos de interface com o usuário.
d) Impressoras são componentes internos do kernel, não dispositivos de E/S.
e) Todos os dispositivos de E/S pertencem necessariamente à categoria de armazenamento.

---

## Questão 5 — Modos de acesso aos dispositivos

Os três mecanismos principais de acesso a dispositivos apresentados no conteúdo são:

a) buffering, caching e spooling.
b) socket, `ioctl()` e PIT.
c) BIOS, MBR e UEFI.
d) E/S em porta, E/S mapeada em memória e DMA.
e) kernel, microkernel e bootloader.

---

## Questão 6 — Kernel e microkernel

Assinale a alternativa correta.

a) Kernel é o núcleo do sistema operacional, responsável por operações fundamentais de gerenciamento de recursos e comunicação com o hardware.
b) Microkernel é obrigatoriamente um bootloader instalado no primeiro setor do disco.
c) Kernel é uma fila de buffers utilizada exclusivamente por impressoras.
d) Microkernel significa que nenhum serviço essencial permanece no núcleo do sistema.
e) Kernel é apenas o arquivo que contém a tela de seleção exibida pelo GRUB.

---

## Questão 7 — E/S em porta

Sobre a E/S em porta, assinale a alternativa correta.

a) Nesse modelo, qualquer instrução de escrita em qualquer endereço da memória principal envia dados automaticamente a um periférico.
b) Nesse modelo, dispositivos são associados a endereços de porta específicos, acessíveis mediante privilégios adequados.
c) A E/S em porta utiliza obrigatoriamente arquivos de spool para transportar cada byte até o dispositivo.
d) O endereço de uma porta é escolhido livremente por qualquer aplicação de usuário durante sua execução.
e) A instrução `out` é utilizada para copiar dados do dispositivo diretamente para a memória RAM por DMA.

---

## Questão 8 — Escrita em porta paralela

Considere o trecho:

```asm
mov dx, 378h
mov al, CARACTERE
out dx, al
```

De acordo com o exemplo apresentado, a interpretação correta é:

a) O caractere armazenado em `dx` é enviado à porta cujo endereço está em `al`.
b) O endereço `378h` corresponde ao controlador DMA, e `out` inicia uma transferência de disco.
c) O conteúdo de `al` é enviado para a porta paralela indicada pelo endereço armazenado em `dx`.
d) A instrução `out` grava o caractere diretamente no disco RAM inicial do Linux.
e) O código consulta o status de uma impressora por E/S mapeada em memória antes de imprimir.

---

## Questão 9 — E/S mapeada em memória

Assinale a alternativa correta sobre E/S mapeada em memória.

a) O processador utiliza endereços associados a dispositivos de modo que operações de leitura ou escrita nesses endereços representem comunicação com o hardware.
b) O dispositivo transfere grandes blocos diretamente para a RAM sem intervenção de nenhum controlador especializado.
c) O modelo impede que novos dispositivos tenham endereços selecionados durante a execução do sistema.
d) O acesso ao dispositivo ocorre exclusivamente mediante a instrução Assembly `out`, sem uso de operações comuns de movimentação de dados.
e) Toda posição de memória física passa a representar simultaneamente um dispositivo de E/S.

---

## Questão 10 — Impressora mapeada em memória

No exemplo de uma impressora LPT mapeada em memória, foram associados os seguintes endereços:

- `FFE0`: caractere a ser impresso;
- `FFE2`: status da impressora.

Assinale a alternativa correta.

a) Ler `FFE0` é a operação indicada para descobrir se a impressora está pronta, enquanto escrever `FFE2` envia o caractere.
b) Escrever no endereço `FFE0` corresponde ao envio do caractere, após a verificação do status por meio de `FFE2`.
c) Os dois endereços representam exclusivamente posições de cache sem relação direta com a impressora.
d) O endereço `FFE2` contém obrigatoriamente o kernel carregado pelo bootloader.
e) A escrita em `FFE0` inicia uma impressão apenas depois que o GRUB transfere controle para o kernel.

---

## Questão 11 — DMA

Em relação ao DMA, assinale a alternativa correta.

a) O DMA aumenta a participação direta do processador, que precisa mover individualmente cada byte entre disco e memória.
b) O DMA é especialmente útil em transferências de grandes volumes de dados, pois um controlador realiza transferências entre dispositivo e memória com menor participação direta da CPU.
c) O DMA é um tipo de fila de impressão criada para impedir documentos intercalados.
d) O DMA substitui completamente os drivers, permitindo que aplicações comuns controlem livremente o hardware.
e) O DMA é utilizado apenas para consultar data e hora atuais por meio de temporizadores.

---

## Questão 12 — Comparação entre mecanismos de acesso

Considerando a comparação apresentada no material, assinale a alternativa correta.

a) E/S em porta foi apresentada como eficiente para grandes transferências, mas incompatível com endereços fixos.
b) E/S mapeada em memória foi apresentada como simples porque não reserva qualquer região de memória para dispositivos.
c) DMA foi apresentado como eficiente, embora mais complexo do que os demais mecanismos.
d) DMA foi apresentado como limitado, pois depende exclusivamente de escrita caractere a caractere.
e) E/S em porta, E/S mapeada em memória e DMA possuem exatamente a mesma finalidade operacional e as mesmas limitações.

---

## Questão 13 — Características de dispositivos de E/S

Assinale a alternativa que apresenta uma associação correta conforme a tabela do conteúdo.

a) Terminal: transferência por bloco; disco: transferência por caractere.
b) Modem: acesso aleatório; SSD: acesso necessariamente sequencial.
c) CD-ROM: apenas escrita; controladora gráfica: leitura e escrita obrigatórias.
d) Disco: leitura e escrita; terminal: transferência de dados por caractere.
e) HDD: assíncrono; teclado: obrigatoriamente síncrono.

---

## Questão 14 — Drivers e `ioctl()`

Sobre acesso privilegiado a dispositivos e a chamada `ioctl()`, assinale a alternativa correta.

a) Aplicações acessam diretamente qualquer registrador físico do dispositivo, sem mediação ou privilégios.
b) Drivers possuem permissão para comunicação direta com hardware, e `ioctl()` pode enviar comandos específicos a um driver associado a um descritor de arquivo.
c) `ioctl()` é a instrução do bootloader responsável por localizar o GRUB no MBR.
d) `ioctl()` realiza exclusivamente a divisão de mensagens de rede em pacotes menores.
e) Drivers somente podem ser utilizados depois que a aplicação copia o kernel para a memória RAM.

---

## Questão 15 — Sockets e temporizadores

Assinale a alternativa correta.

a) Socket é apresentado como uma interface comum para troca de dados em rede, enquanto um PIT pode atuar como temporizador programável para disparo de eventos ou medição de tempo decorrido.
b) Socket é uma técnica de cache utilizada exclusivamente para reduzir tempo de busca em discos.
c) PIT é um arquivo de spool destinado a armazenar documentos antes da impressão.
d) Socket substitui o kernel no carregamento do sistema durante o boot.
e) PIT é uma técnica de DMA empregada apenas para transferir setores do disco ao initramfs.

---

## Questão 16 — E/S com bloqueio

Um processo solicita uma leitura bloqueante de um dispositivo e a operação ainda não terminou. De acordo com o conteúdo, o comportamento esperado é:

a) O processo continua necessariamente executando instruções como se a leitura já estivesse concluída.
b) O processo é removido definitivamente do sistema pelo kernel.
c) O processo permanece aguardando e, após o término da E/S, pode retornar à fila de prontos.
d) O processo passa automaticamente a executar como driver do dispositivo.
e) O processo é convertido em bootloader até que o hardware responda.

---

## Questão 17 — E/S assíncrona e múltiplas threads

Uma aplicação possui várias threads, e apenas uma delas executa uma operação de E/S que fica bloqueada. Assinale a alternativa correta.

a) Todas as threads do sistema operacional obrigatoriamente deixam de executar até a conclusão da operação.
b) As demais threads da aplicação podem continuar executando, enquanto a thread responsável pela E/S permanece aguardando.
c) A thread bloqueada assume imediatamente o papel de controlador DMA.
d) O uso de threads transforma automaticamente uma E/S bloqueante em uma inicialização por UEFI.
e) A aplicação deixa de utilizar drivers porque as threads passam a controlar o hardware diretamente.

---

## Questão 18 — Buffering

Assinale a alternativa que descreve corretamente uma finalidade do buffering.

a) Manter exclusivamente uma duplicata permanente de todo dado original em dispositivo mais rápido.
b) Substituir o bootloader durante a escolha do kernel a ser executado.
c) Compensar diferenças de velocidade ou de tamanho de transferência entre componentes envolvidos na E/S.
d) Impedir qualquer forma de comunicação assíncrona entre processos e dispositivos.
e) Fazer com que impressoras imprimam simultaneamente fragmentos intercalados de documentos distintos.

---

## Questão 19 — Double buffering

Em uma animação gráfica que utiliza double buffering, assinale a alternativa correta.

a) Um buffer pode conter a imagem atualmente exibida, enquanto o outro recebe a construção da próxima imagem.
b) Os dois buffers obrigatoriamente armazenam o MBR e a partição EFI do disco.
c) O segundo buffer elimina completamente a necessidade de dispositivo gráfico.
d) Double buffering significa armazenar uma cópia em disco e outra obrigatoriamente em uma impressora.
e) O mecanismo exige que a CPU não utilize cache durante qualquer operação gráfica.

---

## Questão 20 — Caching e spooling

Assinale a alternativa correta.

a) No caching, existe uma cópia do dado em local mais rápido, enquanto o dado original continua existindo; no spooling, trabalhos podem ser organizados em fila para um dispositivo como a impressora.
b) No buffering, obrigatoriamente existem duas cópias permanentes do dado: uma no disco e outra na cache.
c) Spooling permite que duas impressões sejam fisicamente intercaladas página a página ou caractere a caractere sem necessidade de ordenação.
d) Caching e spooling são sinônimos e existem apenas para acesso a portas seriais.
e) Um arquivo fechado pelo programa nunca pode representar um trabalho pronto para ser enviado a uma impressora.

---

## Questão 21 — Linguagens e desenvolvimento de sistemas operacionais

Assinale a alternativa correta.

a) C e C++ são utilizadas em sistemas operacionais por permitirem programação de alto nível relativamente próxima ao hardware.
b) O material afirma que todos os sistemas operacionais são obrigatoriamente implementados apenas em Assembly.
c) RedOX foi apresentado como exemplo de sistema escrito exclusivamente em Java.
d) MenuetOS foi apresentado como exemplo de sistema desenvolvido em Rust.
e) JX System foi apresentado como sistema integralmente escrito em Assembly, sem qualquer componente em outra linguagem.

---

## Questão 22 — Seleção de mecanismo para grande transferência

Um controlador de disco precisa transferir um grande bloco de dados para a memória. O objetivo é evitar que a CPU execute a movimentação individual de cada unidade de dado. Qual alternativa identifica corretamente o mecanismo mais adequado, conforme o conteúdo?

a) Spooling, pois transforma cada setor do disco em um trabalho de impressão.
b) PIT, pois converte automaticamente o disco em temporizador.
c) DMA, pois permite transferência entre dispositivo e memória com menor participação direta do processador.
d) Socket, pois todo acesso a disco deve ocorrer como comunicação entre computadores.
e) Double buffering gráfico, pois substitui o controlador de disco pelo adaptador de vídeo.

---

## Questão 23 — Buffer, cache e spool em um cenário integrado

Considere as três situações:

I. Dados escritos por um processo são mantidos temporariamente pelo kernel antes da gravação efetiva em disco.
II. Após a gravação, uma cópia dos dados permanece em memória para acelerar novo acesso.
III. Documentos de diferentes processos são mantidos em fila até que a impressora processe cada trabalho.

A associação correta é:

a) I = caching; II = spooling; III = DMA.
b) I = buffering; II = caching; III = spooling.
c) I = spooling; II = buffering; III = socket.
d) I = DMA; II = buffering; III = PIT.
e) I = bootloader; II = kernel; III = microkernel.

---

## Questão 24 — Função do bootloader

Assinale a alternativa que melhor descreve a função do bootloader.

a) Gerenciar exclusivamente a fila de impressões enquanto o kernel executa aplicações.
b) Executar somente depois que o sistema operacional já iniciou todos os serviços de usuário.
c) Gerenciar a inicialização do dispositivo e, quando houver sistema operacional, carregar os elementos necessários para iniciar sua execução.
d) Substituir permanentemente o kernel no gerenciamento de memória, processos e dispositivos.
e) Servir unicamente como driver de placas de rede durante operações assíncronas.

---

## Questão 25 — Kernel e disco RAM inicial no Linux

Durante a inicialização Linux descrita no material, o bootloader deve carregar:

a) somente o sistema de arquivos do usuário, pois o kernel já se encontra executando antes do bootloader.
b) apenas drivers de impressão, pois os demais componentes são carregados por sockets.
c) a imagem do kernel e o disco RAM inicial ou sistema de arquivos inicial contendo arquivos e drivers necessários ao início do sistema.
d) exclusivamente a tabela de partições, pois o GRUB não trabalha com imagem de kernel.
e) somente o MBR para dentro da cache, sem transferir controle a outro componente.

---

## Questão 26 — Inicialização com BIOS/MBR

Em um sistema que utiliza BIOS/MBR, qual sequência corresponde ao primeiro estágio descrito no conteúdo?

a) O kernel inicia o GRUB; o GRUB cria o MBR; o MBR instala o firmware UEFI.
b) O bootloader localizado no MBR examina a tabela de partições, encontra uma partição inicializável e localiza ou carrega o bootloader do segundo estágio.
c) O initramfs é executado antes da leitura do MBR e seleciona diretamente o teclado do usuário.
d) O firmware localiza obrigatoriamente um aplicativo na partição EFI, ignorando qualquer estrutura MBR.
e) O controlador DMA escolhe o sistema operacional e transfere o processo `init` para a impressora.

---

## Questão 27 — Inicialização com EFI/UEFI

Sobre a inicialização com EFI/UEFI, assinale a alternativa correta.

a) O firmware UEFI consulta informações do Boot Manager para identificar o aplicativo UEFI configurado e a partição correspondente, podendo iniciar o GRUB.
b) O UEFI depende obrigatoriamente de o GRUB residir no primeiro setor do disco, sem utilizar entradas de inicialização.
c) O UEFI é um buffer especial utilizado para impedir que documentos impressos sejam misturados.
d) O Boot Manager transfere dados de um disco para a RAM utilizando exclusivamente a porta paralela `378h`.
e) O método EFI/UEFI elimina completamente a necessidade de carregar qualquer kernel.

---

## Questão 28 — Segundo estágio e GRUB

No processo de inicialização apresentado, assinale a alternativa correta sobre o GRUB.

a) O GRUB atua como segundo estágio, pode exibir uma escolha de sistema operacional, carrega o kernel selecionado na memória e transfere-lhe o controle.
b) O GRUB é executado somente depois que o processo inicial e o prompt do usuário já estão ativos.
c) O GRUB substitui o kernel durante toda a execução do sistema operacional.
d) O GRUB é uma técnica de buffering utilizada pelo teclado para operações assíncronas.
e) O GRUB somente pode carregar aplicações embarcadas e nunca sistemas operacionais.

---

## Questão 29 — Fluxo completo de inicialização

Assinale a alternativa que apresenta a sequência coerente com o fluxo simplificado de inicialização Linux descrito no conteúdo.

a) Prompt do usuário → processo inicial → kernel → GRUB → MBR → inicialização do hardware.
b) DMA → spooling → driver de impressora → BIOS → cache → socket.
c) Inicialização do hardware → primeiro estágio do bootloader → GRUB → kernel → processo inicial → ambiente disponível ao usuário.
d) Kernel → BIOS/UEFI → barramento PCI → GRUB → teclado → MBR.
e) Processo inicial → disco RAM inicial → bootloader → firmware → kernel → desligamento.

---

## Questão 30 — Integração entre boot, drivers e entrada/saída

Considere um computador Linux que acabou de ser ligado e precisa acessar o dispositivo onde está localizado seu sistema de arquivos principal. Assinale a alternativa tecnicamente coerente com o conteúdo.

a) Antes de qualquer bootloader, uma aplicação de usuário utiliza `ioctl()` para carregar o kernel diretamente da impressora.
b) O bootloader pode carregar o kernel e um sistema de arquivos inicial contendo drivers necessários; em seguida, o kernel assume o controle e prossegue com a inicialização e o gerenciamento dos dispositivos.
c) O kernel somente pode ser carregado depois que todos os usuários já acessaram o prompt de comandos.
d) O spool de impressão substitui a imagem do kernel e executa o processo inicial antes do GRUB.
e) O acesso ao dispositivo de armazenamento durante a inicialização elimina permanentemente a necessidade de drivers e de mecanismos de E/S.

---

# PARTE 3 — Gabarito objetivo

## Observação sobre o formato solicitado

O modelo originalmente mencionado para “somatória” não foi utilizado porque a configuração específica desta avaliação determina **30 questões de múltipla escolha com alternativas a–e**. Cada questão possui apenas uma alternativa correta.

| Questão | Alternativa correta | Tema principal                   |
| ------: | :-----------------: | -------------------------------- |
|       1 |          b          | Conceito de E/S                  |
|       2 |          b          | Driver de dispositivo            |
|       3 |          c          | Barramentos                      |
|       4 |          c          | Classificação de dispositivos    |
|       5 |          d          | Modos de acesso                  |
|       6 |          a          | Kernel e microkernel             |
|       7 |          b          | E/S em porta                     |
|       8 |          c          | Código com porta paralela        |
|       9 |          a          | E/S mapeada em memória           |
|      10 |          b          | Impressora mapeada               |
|      11 |          b          | DMA                              |
|      12 |          c          | Comparação dos mecanismos        |
|      13 |          d          | Características dos dispositivos |
|      14 |          b          | Drivers e `ioctl()`              |
|      15 |          a          | Socket e PIT                     |
|      16 |          c          | E/S bloqueante                   |
|      17 |          b          | Threads e bloqueio               |
|      18 |          c          | Buffering                        |
|      19 |          a          | Double buffering                 |
|      20 |          a          | Caching e spooling               |
|      21 |          a          | Desenvolvimento de SO            |
|      22 |          c          | Aplicação de DMA                 |
|      23 |          b          | Buffer, cache e spool            |
|      24 |          c          | Bootloader                       |
|      25 |          c          | Kernel e disco RAM inicial       |
|      26 |          b          | BIOS/MBR                         |
|      27 |          a          | EFI/UEFI                         |
|      28 |          a          | GRUB                             |
|      29 |          c          | Fluxo de inicialização           |
|      30 |          b          | Integração boot e E/S            |

---

# PARTE 4 — Correção comentada

## Questão 1 — Conceito de entrada e saída

**Gabarito: b**

| Alternativa | Avaliação | Justificativa                                                                                        |
| ----------- | --------- | ---------------------------------------------------------------------------------------------------- |
| a           | Incorreta | Processos podem utilizar E/S mesmo sem interação direta com usuário, como em acesso a disco ou rede. |
| b           | Correta   | Resume adequadamente a finalidade geral das operações de entrada e saída.                            |
| c           | Incorreta | Transferência entre CPU e cache não define, por si só, E/S com dispositivos.                         |
| d           | Incorreta | Discos são dispositivos de armazenamento e também dispositivos de E/S.                               |
| e           | Incorreta | Dispositivos sem fio também precisam ser gerenciados pelo sistema operacional.                       |

## Questão 2 — Drivers de dispositivo

**Gabarito: b**

| Alternativa | Avaliação | Justificativa                                                                       |
| ----------- | --------- | ----------------------------------------------------------------------------------- |
| a           | Incorreta | Driver é software, não substituição física do controlador.                          |
| b           | Correta   | O driver permite ao sistema operacional controlar e comunicar-se com o dispositivo. |
| c           | Incorreta | Drivers não eliminam os barramentos físicos.                                        |
| d           | Incorreta | O conteúdo associa drivers ao sistema de E/S do kernel e ao acesso privilegiado.    |
| e           | Incorreta | Drivers são empregados em vários tipos de dispositivos.                             |

## Questão 3 — Barramentos

**Gabarito: c**

| Alternativa | Avaliação | Justificativa                                                                  |
| ----------- | --------- | ------------------------------------------------------------------------------ |
| a           | Incorreta | A descrição corresponde a armazenamento temporário ou cache, não a barramento. |
| b           | Incorreta | Barramentos são estruturas de hardware utilizadas além da inicialização.       |
| c           | Correta   | Corresponde à definição apresentada no conteúdo.                               |
| d           | Incorreta | Barramentos não são drivers.                                                   |
| e           | Incorreta | Também conectam componentes internos do computador.                            |

## Questão 4 — Classificação geral dos dispositivos

**Gabarito: c**

| Alternativa | Avaliação | Justificativa                                                                               |
| ----------- | --------- | ------------------------------------------------------------------------------------------- |
| a           | Incorreta | Discos são dispositivos de armazenamento.                                                   |
| b           | Incorreta | Adaptadores de rede integram a categoria de comunicação e realizam E/S.                     |
| c           | Correta   | Teclado e mouse são dispositivos de interface com o usuário.                                |
| d           | Incorreta | Impressora é dispositivo externo controlado pelo sistema, não componente interno do kernel. |
| e           | Incorreta | Há categorias distintas, não apenas armazenamento.                                          |

## Questão 5 — Modos de acesso aos dispositivos

**Gabarito: d**

| Alternativa | Avaliação | Justificativa                                                                 |
| ----------- | --------- | ----------------------------------------------------------------------------- |
| a           | Incorreta | São técnicas de organização ou armazenamento temporário de dados.             |
| b           | Incorreta | São interfaces ou recursos relacionados, não os três modos básicos de acesso. |
| c           | Incorreta | São componentes ou métodos ligados ao processo de inicialização.              |
| d           | Correta   | Reproduz os três mecanismos estudados.                                        |
| e           | Incorreta | São conceitos de arquitetura e inicialização do sistema.                      |

## Questão 6 — Kernel e microkernel

**Gabarito: a**

| Alternativa | Avaliação | Justificativa                                                                    |
| ----------- | --------- | -------------------------------------------------------------------------------- |
| a           | Correta   | Kernel é o núcleo responsável pelas operações essenciais do sistema operacional. |
| b           | Incorreta | Microkernel é uma organização arquitetural do sistema, não bootloader.           |
| c           | Incorreta | A definição descreve spool ou buffering, não kernel.                             |
| d           | Incorreta | O microkernel mantém funcionalidades essenciais no núcleo.                       |
| e           | Incorreta | A tela de seleção pertence ao processo de inicialização pelo bootloader.         |

## Questão 7 — E/S em porta

**Gabarito: b**

| Alternativa | Avaliação | Justificativa                                                                                     |
| ----------- | --------- | ------------------------------------------------------------------------------------------------- |
| a           | Incorreta | Essa descrição aproxima-se de E/S mapeada em memória, não de porta.                               |
| b           | Correta   | O dispositivo é associado a um endereço específico de porta e o acesso exige privilégio adequado. |
| c           | Incorreta | Arquivos de spool não constituem o mecanismo básico de acesso por porta.                          |
| d           | Incorreta | Aplicações comuns não escolhem livremente endereços físicos de porta.                             |
| e           | Incorreta | `out` envia dados a uma porta; não representa transferência DMA para RAM.                         |

## Questão 8 — Escrita em porta paralela

**Gabarito: c**

| Alternativa | Avaliação | Justificativa                                                                         |
| ----------- | --------- | ------------------------------------------------------------------------------------- |
| a           | Incorreta | Inverte o papel dos registradores: `dx` contém o endereço e `al` contém o dado.       |
| b           | Incorreta | No exemplo, `378h` corresponde à porta paralela.                                      |
| c           | Correta   | A instrução `out dx, al` envia o caractere para a porta indicada.                     |
| d           | Incorreta | O código não se refere a disco RAM inicial.                                           |
| e           | Incorreta | O trecho utiliza E/S em porta e não verifica previamente o status mapeado em memória. |

## Questão 9 — E/S mapeada em memória

**Gabarito: a**

| Alternativa | Avaliação | Justificativa                                                                            |
| ----------- | --------- | ---------------------------------------------------------------------------------------- |
| a           | Correta   | Um endereço físico reservado passa a representar leitura ou escrita em dispositivo.      |
| b           | Incorreta | A descrição corresponde de forma incompleta ao DMA, não à MMIO.                          |
| c           | Incorreta | O material associa MMIO à possibilidade de escolha de endereços para novos dispositivos. |
| d           | Incorreta | A MMIO utiliza operações normais de movimentação de dados em endereços mapeados.         |
| e           | Incorreta | Apenas intervalos reservados representam dispositivos.                                   |

## Questão 10 — Impressora mapeada em memória

**Gabarito: b**

| Alternativa | Avaliação | Justificativa                                                           |
| ----------- | --------- | ----------------------------------------------------------------------- |
| a           | Incorreta | Inverte as funções de `FFE0` e `FFE2`.                                  |
| b           | Correta   | O status é consultado em `FFE2` e o caractere é escrito em `FFE0`.      |
| c           | Incorreta | Os endereços estão associados ao dispositivo, não apenas à cache.       |
| d           | Incorreta | O endereço corresponde a status da impressora, não ao kernel.           |
| e           | Incorreta | A operação exemplifica E/S mapeada, independentemente do papel do GRUB. |

## Questão 11 — DMA

**Gabarito: b**

| Alternativa | Avaliação | Justificativa                                                              |
| ----------- | --------- | -------------------------------------------------------------------------- |
| a           | Incorreta | O objetivo do DMA é reduzir a participação direta da CPU na transferência. |
| b           | Correta   | Resume a finalidade e a vantagem do DMA conforme o conteúdo.               |
| c           | Incorreta | A descrição corresponde ao spooling.                                       |
| d           | Incorreta | DMA não elimina drivers nem privilégios de acesso.                         |
| e           | Incorreta | Serviços de tempo estão associados a temporizadores, não ao DMA.           |

## Questão 12 — Comparação entre mecanismos de acesso

**Gabarito: c**

| Alternativa | Avaliação | Justificativa                                                         |
| ----------- | --------- | --------------------------------------------------------------------- |
| a           | Incorreta | Porta foi apresentada como simples, porém limitada.                   |
| b           | Incorreta | MMIO utiliza regiões de memória associadas a dispositivos.            |
| c           | Correta   | O quadro comparativo indica DMA como eficiente, porém complexo.       |
| d           | Incorreta | A limitação indicada não corresponde ao DMA.                          |
| e           | Incorreta | Os mecanismos diferem quanto a funcionamento, vantagens e limitações. |

## Questão 13 — Características de dispositivos de E/S

**Gabarito: d**

| Alternativa | Avaliação | Justificativa                                                       |
| ----------- | --------- | ------------------------------------------------------------------- |
| a           | Incorreta | O material associa terminal a caractere e disco a bloco.            |
| b           | Incorreta | O modem é associado a acesso sequencial e o SSD a acesso aleatório. |
| c           | Incorreta | CD-ROM é associado a leitura, e controladora gráfica a escrita.     |
| d           | Correta   | Ambas as associações estão de acordo com a tabela apresentada.      |
| e           | Incorreta | O material associa HDD a síncrono e teclado a assíncrono.           |

## Questão 14 — Drivers e `ioctl()`

**Gabarito: b**

| Alternativa | Avaliação | Justificativa                                                                      |
| ----------- | --------- | ---------------------------------------------------------------------------------- |
| a           | Incorreta | O acesso direto ao hardware exige controle e privilégios adequados.                |
| b           | Correta   | Relaciona corretamente drivers e o uso de `ioctl()` para comandos específicos.     |
| c           | Incorreta | `ioctl()` não integra o processo BIOS/MBR de localização do GRUB.                  |
| d           | Incorreta | Fragmentação de mensagens de rede é tema de buffering, não definição de `ioctl()`. |
| e           | Incorreta | Drivers não dependem de aplicações copiarem o kernel para RAM.                     |

## Questão 15 — Sockets e temporizadores

**Gabarito: a**

| Alternativa | Avaliação | Justificativa                                                        |
| ----------- | --------- | -------------------------------------------------------------------- |
| a           | Correta   | Relaciona adequadamente socket à rede e PIT a serviços temporizados. |
| b           | Incorreta | Socket é interface de comunicação, não cache de disco.               |
| c           | Incorreta | PIT é temporizador, não arquivo de spool.                            |
| d           | Incorreta | Socket não executa a função de bootloader.                           |
| e           | Incorreta | PIT não foi apresentado como mecanismo de transferência DMA.         |

## Questão 16 — E/S com bloqueio

**Gabarito: c**

| Alternativa | Avaliação | Justificativa                                                      |
| ----------- | --------- | ------------------------------------------------------------------ |
| a           | Incorreta | Na E/S bloqueante, o processo solicitante aguarda a conclusão.     |
| b           | Incorreta | Ele é suspenso temporariamente, não removido definitivamente.      |
| c           | Correta   | Após a conclusão da operação, retorna à fila de prontos.           |
| d           | Incorreta | Solicitar E/S não transforma o processo em driver.                 |
| e           | Incorreta | Bootloader pertence à inicialização, não ao bloqueio de processos. |

## Questão 17 — E/S assíncrona e múltiplas threads

**Gabarito: b**

| Alternativa | Avaliação | Justificativa                                                                 |
| ----------- | --------- | ----------------------------------------------------------------------------- |
| a           | Incorreta | O bloqueio pode restringir-se à thread que realizou a operação.               |
| b           | Correta   | Corresponde à estratégia apresentada para evitar bloqueio total da aplicação. |
| c           | Incorreta | Thread da aplicação não se torna controlador DMA.                             |
| d           | Incorreta | Threads e UEFI tratam de problemas distintos.                                 |
| e           | Incorreta | O uso de threads não remove a mediação dos drivers.                           |

## Questão 18 — Buffering

**Gabarito: c**

| Alternativa | Avaliação | Justificativa                                                                      |
| ----------- | --------- | ---------------------------------------------------------------------------------- |
| a           | Incorreta | A ideia de duplicidade do dado caracteriza caching, não necessariamente buffering. |
| b           | Incorreta | Buffering não substitui bootloader.                                                |
| c           | Correta   | São duas das finalidades apresentadas para buffers.                                |
| d           | Incorreta | Buffering pode justamente apoiar operações assíncronas.                            |
| e           | Incorreta | Para impressoras, a organização evita intercalar indevidamente documentos.         |

## Questão 19 — Double buffering

**Gabarito: a**

| Alternativa | Avaliação | Justificativa                                                           |
| ----------- | --------- | ----------------------------------------------------------------------- |
| a           | Correta   | Essa é a aplicação gráfica descrita no material.                        |
| b           | Incorreta | MBR e partição EFI pertencem à inicialização, não à animação gráfica.   |
| c           | Incorreta | O buffer não elimina a necessidade do dispositivo que exibirá a imagem. |
| d           | Incorreta | A definição não exige disco nem impressora.                             |
| e           | Incorreta | O conteúdo não estabelece tal restrição de cache.                       |

## Questão 20 — Caching e spooling

**Gabarito: a**

| Alternativa | Avaliação | Justificativa                                                                    |
| ----------- | --------- | -------------------------------------------------------------------------------- |
| a           | Correta   | Diferencia corretamente cópia rápida e fila organizada de trabalhos.             |
| b           | Incorreta | Buffering pode manter temporariamente a única cópia disponível naquele estágio.  |
| c           | Incorreta | Spooling organiza trabalhos para evitar intercalação inadequada.                 |
| d           | Incorreta | São conceitos distintos e não limitados a portas seriais.                        |
| e           | Incorreta | No exemplo de impressão, o arquivo fechado sinaliza trabalho pronto para a fila. |

## Questão 21 — Linguagens e desenvolvimento de sistemas operacionais

**Gabarito: a**

| Alternativa | Avaliação | Justificativa                                                         |
| ----------- | --------- | --------------------------------------------------------------------- |
| a           | Correta   | Essa é a motivação indicada para o uso recorrente de C e C++.         |
| b           | Incorreta | O material cita C, C++, Java, Assembly e Rust em diferentes sistemas. |
| c           | Incorreta | RedOX foi associado a Rust.                                           |
| d           | Incorreta | MenuetOS foi associado a Assembly.                                    |
| e           | Incorreta | JX System foi associado a Java, com microkernel em C e Assembly.      |

## Questão 22 — Seleção de mecanismo para grande transferência

**Gabarito: c**

| Alternativa | Avaliação | Justificativa                                                                 |
| ----------- | --------- | ----------------------------------------------------------------------------- |
| a           | Incorreta | Spooling resolve organização de trabalhos para dispositivos como impressoras. |
| b           | Incorreta | PIT está relacionado a temporização.                                          |
| c           | Correta   | DMA é adequado para grandes transferências entre dispositivo e memória.       |
| d           | Incorreta | Socket trata de comunicação em rede, não substitui acesso a disco.            |
| e           | Incorreta | Double buffering gráfico não substitui controlador de disco.                  |

## Questão 23 — Buffer, cache e spool em um cenário integrado

**Gabarito: b**

| Alternativa | Avaliação | Justificativa                                                                              |
| ----------- | --------- | ------------------------------------------------------------------------------------------ |
| a           | Incorreta | Troca os papéis das três técnicas.                                                         |
| b           | Correta   | I representa semântica de cópia/buffering; II representa caching; III representa spooling. |
| c           | Incorreta | A fila de impressão não é socket, e a escrita pendente não é spool.                        |
| d           | Incorreta | PIT não organiza documentos para impressão.                                                |
| e           | Incorreta | Os três elementos citados são arquiteturais ou de inicialização, não técnicas do cenário.  |

## Questão 24 — Função do bootloader

**Gabarito: c**

| Alternativa | Avaliação | Justificativa                                                                      |
| ----------- | --------- | ---------------------------------------------------------------------------------- |
| a           | Incorreta | Fila de impressão é gerenciada por spooling.                                       |
| b           | Incorreta | O bootloader atua antes da execução normal do sistema operacional.                 |
| c           | Correta   | Define adequadamente o papel do bootloader.                                        |
| d           | Incorreta | Após carregar o kernel, o bootloader transfere o controle; não substitui o núcleo. |
| e           | Incorreta | Bootloader não é driver exclusivo de rede.                                         |

## Questão 25 — Kernel e disco RAM inicial no Linux

**Gabarito: c**

| Alternativa | Avaliação | Justificativa                                                                         |
| ----------- | --------- | ------------------------------------------------------------------------------------- |
| a           | Incorreta | O kernel é carregado pelo processo de inicialização.                                  |
| b           | Incorreta | O disco RAM inicial pode conter componentes críticos e drivers, não apenas impressão. |
| c           | Correta   | Corresponde ao fluxo Linux apresentado.                                               |
| d           | Incorreta | O GRUB carrega a imagem do kernel selecionado.                                        |
| e           | Incorreta | O processo envolve mais do que carregar MBR para cache.                               |

## Questão 26 — Inicialização com BIOS/MBR

**Gabarito: b**

| Alternativa | Avaliação | Justificativa                                                      |
| ----------- | --------- | ------------------------------------------------------------------ |
| a           | Incorreta | Inverte a ordem: o bootloader antecede o kernel.                   |
| b           | Correta   | Resume o primeiro estágio BIOS/MBR descrito.                       |
| c           | Incorreta | O MBR é lido antes de qualquer execução normal do sistema inicial. |
| d           | Incorreta | Essa descrição corresponde ao método EFI/UEFI, não BIOS/MBR.       |
| e           | Incorreta | DMA e impressora não selecionam o sistema operacional.             |

## Questão 27 — Inicialização com EFI/UEFI

**Gabarito: a**

| Alternativa | Avaliação | Justificativa                                                                      |
| ----------- | --------- | ---------------------------------------------------------------------------------- |
| a           | Correta   | Representa a consulta do Boot Manager e a execução do aplicativo UEFI configurado. |
| b           | Incorreta | Confunde EFI/UEFI com o modelo BIOS/MBR.                                           |
| c           | Incorreta | A definição corresponde a spool, não a firmware de inicialização.                  |
| d           | Incorreta | Porta paralela não define o mecanismo de localização de boot UEFI.                 |
| e           | Incorreta | O sistema operacional ainda precisa ter seu kernel carregado.                      |

## Questão 28 — Segundo estágio e GRUB

**Gabarito: a**

| Alternativa | Avaliação | Justificativa                                                          |
| ----------- | --------- | ---------------------------------------------------------------------- |
| a           | Correta   | Resume as funções atribuídas ao GRUB no segundo estágio.               |
| b           | Incorreta | O GRUB ocorre antes de kernel, processo inicial e prompt.              |
| c           | Incorreta | O kernel assume a execução do sistema após ser carregado.              |
| d           | Incorreta | GRUB é bootloader, não buffering de teclado.                           |
| e           | Incorreta | O material apresenta seu uso no carregamento de sistemas operacionais. |

## Questão 29 — Fluxo completo de inicialização

**Gabarito: c**

| Alternativa | Avaliação | Justificativa                                                                  |
| ----------- | --------- | ------------------------------------------------------------------------------ |
| a           | Incorreta | Apresenta a sequência invertida.                                               |
| b           | Incorreta | Mistura mecanismos de E/S sem formar sequência de boot.                        |
| c           | Correta   | Mantém a progressão hardware, bootloaders, kernel, processo inicial e usuário. |
| d           | Incorreta | Kernel não antecede BIOS/UEFI nem GRUB nesse fluxo.                            |
| e           | Incorreta | Inverte a função do bootloader e mistura etapas incompatíveis.                 |

## Questão 30 — Integração entre boot, drivers e entrada/saída

**Gabarito: b**

| Alternativa | Avaliação | Justificativa                                                                               |
| ----------- | --------- | ------------------------------------------------------------------------------------------- |
| a           | Incorreta | Aplicações de usuário não atuam antes do bootloader nem carregam kernel via impressora.     |
| b           | Correta   | Integra corretamente bootloader, sistema inicial, drivers e controle posterior pelo kernel. |
| c           | Incorreta | O kernel precisa estar carregado antes da disponibilização do ambiente ao usuário.          |
| d           | Incorreta | Spool de impressão não substitui o kernel nem antecede o GRUB no boot.                      |
| e           | Incorreta | O gerenciamento de dispositivos continua exigindo mecanismos de E/S e drivers adequados.    |

---

## Respostas esperadas das discursivas

**Não se aplica.** Esta versão da avaliação contém exclusivamente 30 questões objetivas de múltipla escolha, conforme a configuração solicitada.

---

# PARTE 5 — Auditoria final da prova

| Verificação                                                 | Resultado                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Todas as questões cobram apenas o conteúdo fornecido?       | **Sim.** Os itens limitam-se às Unidades 5 e 6: E/S, drivers, modos de acesso, interfaces, bloqueio, buffering, caching, spooling, kernel/microkernel e inicialização por bootloader.                                                                     |
| As afirmações possuem resposta inequívoca?                  | **Sim.** Cada questão possui uma única alternativa correta; as alternativas incorretas apresentam inversões ou associações incompatíveis com o conteúdo.                                                                                                  |
| Os cálculos foram conferidos?                               | **Não se aplica.** O conteúdo permite interpretação de endereços e sequências, mas não exige cálculo numérico nesta avaliação.                                                                                                                            |
| Há equilíbrio entre dificuldade fácil, média e médio-alta?  | **Sim.** Foram elaboradas 6 questões fáceis, 15 médias e 9 médio-altas, correspondendo a 20%, 50% e 30%.                                                                                                                                                  |
| As questões avançam do conceito básico à aplicação técnica? | **Sim.** A prova inicia em definições de E/S e drivers, avança para mecanismos e interfaces, e termina com análise de boot e integração com drivers.                                                                                                      |
| As questões de aplicação exigem compreensão aprofundada?    | **Sim.** Especialmente as questões 22 a 30, que envolvem seleção de mecanismo, diferenciação integrada e ordenação do fluxo de boot.                                                                                                                      |
| Há cópia literal de questões anteriores?                    | **Não.** Todas as questões foram formuladas especificamente para o conteúdo apresentado.                                                                                                                                                                  |
| Há afirmações potencialmente ambíguas ou controversas?      | **Nenhuma mantida na versão final.** A observação dos slides sobre ausência de portas de E/S em processadores de 64 bits não foi utilizada como premissa correta em nenhuma questão, evitando controvérsia técnica externa ao escopo seguro da avaliação. |
| O formato corresponde ao pedido do usuário?                 | **Sim, com adaptação explicitada.** Foram produzidas 30 questões objetivas de múltipla escolha a–e; por isso, não foram inseridas questões discursivas nem gabarito por somatória.                                                                        |

---

## Síntese de validação docente

A avaliação foi estruturada para verificar:

- reconhecimento de definições essenciais, sem depender apenas de memorização;
- distinção entre E/S em porta, E/S mapeada em memória e DMA;
- diferenciação entre buffering, caching e spooling;
- interpretação do comportamento de processos em operações bloqueantes e assíncronas;
- compreensão da função de drivers, sockets, temporizadores, kernel e microkernel;
- análise ordenada da inicialização Linux por BIOS/MBR ou EFI/UEFI, GRUB, kernel e processo inicial;
- integração entre bootloader, drivers e gerenciamento de dispositivos.

As alternativas incorretas foram construídas por troca de função, inversão de etapas, atribuição ao mecanismo errado ou associação inadequada entre conceitos tecnicamente próximos.

[1]: https://www.kernel.org/doc/html/v6.15/driver-api/device-io.html "Bus-Independent Device Accesses — The Linux Kernel  documentation"
