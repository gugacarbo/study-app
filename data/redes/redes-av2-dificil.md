# Questões adicionais — dificuldade maior

**51.** Um datagrama IPv4 possui `IHL = 7` e `Total Length = 1500 bytes`. Considerando que o campo IHL mede o cabeçalho em palavras de 4 bytes, qual é o tamanho do payload transportado por esse datagrama?

A) 1472 bytes
B) 1480 bytes
C) 1493 bytes
D) 1500 bytes
E) 1528 bytes

**52.** Um datagrama IPv4 possui cabeçalho de 20 bytes e payload de 3000 bytes. Ele precisa atravessar um enlace com MTU de 1500 bytes. Considerando fragmentação IPv4, qual alternativa descreve corretamente os tamanhos dos payloads fragmentados e seus offsets?

A) 1500, 1500 e 20 bytes; offsets 0, 1500 e 3000
B) 1480, 1480 e 40 bytes; offsets 0, 185 e 370
C) 1480, 1480 e 40 bytes; offsets 0, 1480 e 2960
D) 1500 e 1500 bytes; offsets 0 e 187
E) 1460, 1460 e 80 bytes; offsets 0, 182 e 365

**53.** A rede `192.168.0.0/22` agrega quatro redes /24 consecutivas. Qual é a faixa total de endereços e o broadcast dessa super-rede?

A) 192.168.0.0 até 192.168.0.255; broadcast 192.168.0.255
B) 192.168.0.0 até 192.168.1.255; broadcast 192.168.1.255
C) 192.168.0.0 até 192.168.2.255; broadcast 192.168.2.255
D) 192.168.0.0 até 192.168.3.255; broadcast 192.168.3.255
E) 192.168.0.0 até 192.168.4.255; broadcast 192.168.4.255

**54.** Um host possui IP `192.168.10.77/27`. Qual alternativa apresenta corretamente o endereço de rede, o primeiro host válido, o último host válido e o broadcast?

A) Rede 192.168.10.64; primeiro 192.168.10.65; último 192.168.10.94; broadcast 192.168.10.95
B) Rede 192.168.10.0; primeiro 192.168.10.1; último 192.168.10.126; broadcast 192.168.10.127
C) Rede 192.168.10.32; primeiro 192.168.10.33; último 192.168.10.62; broadcast 192.168.10.63
D) Rede 192.168.10.64; primeiro 192.168.10.66; último 192.168.10.95; broadcast 192.168.10.96
E) Rede 192.168.10.77; primeiro 192.168.10.78; último 192.168.10.94; broadcast 192.168.10.95

**55.** Um pacote IP chega a um roteador com `TTL = 1`. O roteador precisa encaminhá-lo para outro roteador. O que deve ocorrer?

A) O roteador encaminha o pacote com TTL igual a 0.
B) O roteador reinicia o TTL com o valor padrão da rede.
C) O roteador descarta o pacote e pode gerar uma mensagem ICMP de tempo excedido.
D) O roteador fragmenta o pacote obrigatoriamente.
E) O roteador converte o pacote de IPv4 para IPv6.

**56.** Um servidor web escuta na porta TCP 80 e recebe conexões simultâneas destes clientes: `10.0.0.2:50001` e `10.0.0.3:50001`, ambos acessando `200.1.1.10:80`. Como o sistema operacional do servidor distingue as conexões?

A) Apenas pela porta de destino 80.
B) Apenas pelo IP do servidor.
C) Pela quádrupla IP origem, porta origem, IP destino e porta destino.
D) Pelo campo TTL de cada pacote.
E) Pelo endereço MAC dos clientes.

**57.** Em uma comunicação UDP, dois datagramas chegam ao destino fora de ordem. Considerando apenas o serviço UDP básico, qual é a consequência correta?

A) O UDP reordena os datagramas automaticamente.
B) O UDP solicita retransmissão seletiva ao emissor.
C) O UDP entrega os datagramas à aplicação conforme recebidos, sem garantia de ordenação.
D) O UDP inicia um three-way handshake para corrigir a ordem.
E) O UDP converte a conexão para TCP.

**58.** Em um protocolo confiável de dados, ACKs podem ser corrompidos, mas os pacotes de dados chegam corretamente. Qual mecanismo é essencial para evitar que uma retransmissão causada por ACK corrompido seja entregue como dado duplicado à aplicação?

A) NAT.
B) TTL.
C) Número de sequência.
D) Endereço de broadcast.
E) Máscara CIDR.

**59.** Um protocolo usa timeout para detectar perdas. Em uma rede com grande variação de atraso, escolher um timeout fixo muito próximo ao menor RTT observado tende a causar:

A) Menos retransmissões e menor congestionamento.
B) Retransmissões desnecessárias por confundir atraso com perda.
C) Eliminação da necessidade de ACKs.
D) Aumento automático da MTU.
E) Entrega ordenada sem controle adicional.

**60.** Em uma janela de transmissão com segmentos 1, 2, 3, 4 e 5, o segmento 3 é perdido, mas 4 e 5 chegam ao receptor. Qual alternativa compara corretamente Go-Back-N e Selective Repeat?

A) Go-Back-N armazena 4 e 5; Selective Repeat descarta 4 e 5.
B) Ambos retransmitem apenas o segmento 3.
C) Go-Back-N tende a descartar 4 e 5 e retransmitir a partir do 3; Selective Repeat pode armazenar 4 e 5 e pedir/retransmitir apenas o 3.
D) Go-Back-N não usa ACKs; Selective Repeat não usa números de sequência.
E) Ambos encerram a conexão TCP.

**61.** Uma aplicação envia via TCP duas chamadas: primeiro `"ABC"` e depois `"DEF"`. No receptor, a aplicação lê primeiro `"ABCD"` e depois `"EF"`. Isso é possível porque:

A) O TCP preserva fronteiras exatas de mensagens da aplicação.
B) O TCP é byte-stream, entregando uma sequência contínua de bytes.
C) O UDP foi usado por baixo do TCP.
D) O IP reagrupou mensagens da camada de aplicação.
E) O socket impede leituras parciais.

**62.** Durante o encerramento TCP, um lado envia `FIN` para indicar que não enviará mais dados. Entretanto, ele ainda pode receber dados até o outro lado também encerrar sua direção da comunicação. Esse comportamento ocorre porque:

A) O TCP encerra as duas direções sempre ao mesmo tempo.
B) O encerramento TCP é independente em cada direção da conexão.
C) O FIN funciona como SYN.
D) O ACK cancela o fechamento.
E) O TCP passa a operar como UDP após o FIN.

**63.** Um download de 10 GB usa pontos de sincronização a cada 1 GB. A conexão falha quando 8,3 GB já foram recebidos. Considerando o conceito de sincronização da camada de sessão, qual seria a retomada mais adequada?

A) Reiniciar obrigatoriamente do byte zero.
B) Retomar a partir do último ponto confirmado, próximo de 8 GB.
C) Retomar a partir de 8,3 GB sem qualquer validação.
D) Descartar todos os dados e renegociar o endereço IP.
E) Converter o arquivo para outro formato antes de continuar.

**64.** Dois hosts com arquiteturas diferentes transmitem um inteiro binário de 32 bits. Um usa little-endian e o outro big-endian. Qual solução está mais alinhada à função da camada de apresentação?

A) Aumentar o TTL para evitar ambiguidade.
B) Usar uma sintaxe de transferência comum, como ASN.1, XML ou JSON, para padronizar a representação.
C) Trocar a porta TCP de origem.
D) Fragmentar o datagrama em blocos de 8 bytes.
E) Usar flooding para garantir entrega.

**65.** Uma aplicação bancária transmite valores monetários, enquanto uma aplicação de vídeo ao vivo transmite imagens em tempo real. Considerando compressão na camada de apresentação, qual escolha é mais adequada?

A) Compressão com perdas para as duas, pois sempre reduz tráfego.
B) Compressão sem perdas para vídeo e com perdas para valores bancários.
C) Compressão com perdas para valores bancários e sem compressão para vídeo.
D) Compressão sem perdas para dados bancários e, quando aceitável, compressão com perdas para vídeo.
E) Nenhuma das duas aplicações pode usar compressão.

---

## Gabarito

51. A
52. B
53. D
54. A
55. C
56. C
57. C
58. C
59. B
60. C
61. B
62. B
63. B
64. B
65. D
