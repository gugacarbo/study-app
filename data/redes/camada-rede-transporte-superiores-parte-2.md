# Redes de Computadores — Camada de Rede, Transporte e Camadas Superiores (Parte 2)

> Lista de 25 questões de múltipla escolha (questões 26 a 50 de 50).
> Tópicos: camada de transporte (TCP/UDP), protocolos confiáveis, camadas de sessão, apresentação e aplicação.

## Questões

**26.** A camada de transporte fornece, entre outras funções:

A) Comunicação processo-a-processo.
B) Apenas comunicação enlace-a-enlace.
C) Apenas endereçamento físico.
D) Conversão de formatos de texto.
E) Gerenciamento de sessão com token.

**27.** Um endereço de socket é formado por:

A) MAC e TTL.
B) IP e porta.
C) IP e checksum do cabeçalho.
D) Porta e endereço físico.
E) Número de sequência e ACK.

**28.** As portas na camada de transporte possuem tamanho de:

A) 4 bits.
B) 8 bits.
C) 16 bits.
D) 32 bits.
E) 128 bits.

**29.** O intervalo de portas bem conhecidas/reservadas é:

A) 0 a 1023.
B) 1024 a 49151.
C) 49152 a 65535.
D) 0 a 255.
E) 32768 a 65535.

**30.** A multiplexação na camada de transporte permite que:

A) Várias aplicações usem a rede simultaneamente por meio de portas.
B) Um IP seja convertido automaticamente em MAC.
C) O roteador calcule o menor caminho por flooding.
D) O TCP elimine a necessidade de ACKs.
E) O UDP estabeleça conexão antes da transmissão.

**31.** Na demultiplexação TCP, o sistema operacional identifica uma conexão por meio da:

A) Dupla formada por MAC de origem e MAC de destino.
B) Quádrupla IP origem, porta origem, IP destino e porta destino.
C) Máscara de rede e gateway padrão.
D) Apenas porta de destino.
E) Apenas endereço IP de destino.

**32.** No UDP, a demultiplexação é mais simples porque normalmente se baseia principalmente em:

A) Porta de destino e endereço de destino.
B) Número de sequência e ACK.
C) Estado da conexão.
D) Three-way handshake.
E) Janela de congestionamento.

**33.** O UDP é considerado:

A) Orientado à conexão e confiável.
B) Sem conexão e não confiável quanto à entrega.
C) Exclusivo para aplicações bancárias.
D) Obrigatório para HTTP.
E) Mais complexo que TCP em controle de fluxo.

**34.** Um motivo para usar UDP em aplicações como streaming ou jogos online é:

A) Ele sempre retransmite todos os pacotes perdidos.
B) Ele reduz overhead e latência em comparação com TCP.
C) Ele garante entrega ordenada de bytes.
D) Ele exige conexão antes de enviar dados.
E) Ele impede perda de pacotes.

**35.** O cabeçalho UDP possui:

A) 4 bytes.
B) 8 bytes.
C) 16 bytes.
D) 20 bytes.
E) 60 bytes.

**36.** O checksum do UDP serve para:

A) Garantir entrega confiável dos datagramas.
B) Verificar integridade dos dados e do cabeçalho UDP.
C) Definir o número de saltos.
D) Controlar congestionamento.
E) Identificar o endereço de rede.

**37.** Um protocolo RDT para canal com corrupção de bits, mas sem perda de pacotes, precisa principalmente de:

A) ACKs/NAKs e detecção de erros.
B) NAT e endereços privados.
C) CIDR e VLSM.
D) Compressão com perdas.
E) Flooding obrigatório.

**38.** Em protocolos confiáveis, um timeout muito curto pode causar:

A) Retransmissões desnecessárias.
B) Eliminação completa da perda de pacotes.
C) Redução obrigatória do checksum.
D) Aumento da quantidade de endereços IPv4.
E) Desativação do controle de fluxo.

**39.** Em protocolos confiáveis, um timeout muito longo pode causar:

A) Detecção lenta de perdas e maior atraso na recuperação.
B) Encerramento imediato da conexão TCP.
C) Uso automático de UDP.
D) Conversão de endereço público para privado.
E) Redução do TTL a zero.

**40.** No Go-Back-N, quando um segmento intermediário é perdido, o transmissor tende a:

A) Retransmitir apenas o pacote perdido.
B) Retransmitir o pacote perdido e todos os posteriores na janela.
C) Ignorar o erro, pois UDP já garante entrega.
D) Enviar um pacote ICMP multicast.
E) Abrir uma nova conexão TCP.

**41.** No Selective Repeat, quando um segmento é perdido, o receptor pode:

A) Armazenar segmentos recebidos fora de ordem em buffer.
B) Descartar obrigatoriamente todos os segmentos posteriores.
C) Desativar ACKs.
D) Usar somente flooding.
E) Substituir portas por endereços IP.

**42.** O TCP é orientado à conexão porque:

A) Exige um processo de estabelecimento antes da troca confiável de dados.
B) Usa apenas endereços MAC.
C) Não possui controle de erro.
D) Nunca usa ACKs.
E) Não mantém estado nos hosts.

**43.** A característica byte-stream do TCP significa que:

A) A aplicação enxerga uma sequência contínua de bytes, não mensagens isoladas.
B) O TCP só transmite arquivos binários.
C) Cada chamada de envio vira obrigatoriamente um pacote IP separado.
D) O TCP não usa números de sequência.
E) O TCP não permite reordenação.

**44.** A sequência correta do three-way handshake TCP é:

A) ACK, FIN, SYN.
B) SYN, SYN-ACK, ACK.
C) FIN, ACK, FIN.
D) SYN, FIN, ACK.
E) UDP, ACK, SYN.

**45.** No encerramento TCP com four-way handshake, as flags principais são:

A) SYN e TTL.
B) FIN e ACK.
C) UDP e TCP.
D) IHL e Protocol.
E) ICMP e IGMP.

**46.** O campo Sequence Number do TCP é usado para:

A) Identificar a posição dos bytes no fluxo transmitido.
B) Indicar o número de saltos restantes.
C) Definir a máscara de rede.
D) Armazenar o endereço MAC de origem.
E) Escolher o algoritmo de roteamento.

**47.** A camada de sessão, no modelo OSI, está relacionada a:

A) Gestão de diálogo, sincronização e atividades.
B) Endereçamento IP e roteamento.
C) Controle de congestionamento TCP.
D) Fragmentação de datagramas IPv4.
E) Escolha de portas efêmeras.

**48.** Em comunicação half-duplex, o gerenciamento de token é útil porque:

A) Define qual lado pode transmitir em determinado momento.
B) Criptografa automaticamente os dados.
C) Remove a necessidade de endereços IP.
D) Aumenta o número de portas disponíveis.
E) Substitui o checksum.

**49.** A camada de apresentação é responsável por funções como:

A) Conversão, compressão e criptografia de dados.
B) Roteamento salto-a-salto.
C) Cálculo de TTL.
D) Definição de portas bem conhecidas.
E) Controle de congestionamento TCP.

**50.** Em protocolos da camada de aplicação, é essencial definir:

A) Formato das mensagens, semântica, regras de envio e tratamento das respostas.
B) Apenas o endereço MAC dos hosts.
C) Apenas o número de saltos entre roteadores.
D) Somente o tamanho da máscara CIDR.
E) Apenas a voltagem do meio físico.

## Gabarito

26-A, 27-B, 28-C, 29-A, 30-A, 31-B, 32-A, 33-B, 34-B, 35-B, 36-B, 37-A, 38-A, 39-A, 40-B, 41-A, 42-A, 43-A, 44-B, 45-B, 46-A, 47-A, 48-A, 49-A, 50-A
