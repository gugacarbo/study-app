# Redes de Computadores — Camada de Rede, Transporte e Camadas Superiores (Parte 1)

> Lista de 25 questões de múltipla escolha (questões 1 a 25 de 50).
> Tópicos: camada de rede, endereçamento IP, CIDR, roteamento, NAT, ICMP, IGMP e início da camada de transporte.

## Questões

**1.** Na pilha TCP/IP, a principal responsabilidade da camada de rede é:

A) Garantir comunicação processo-a-processo por meio de portas.
B) Realizar comunicação host-a-host entre redes interconectadas.
C) Converter dados entre ASCII e EBCDIC.
D) Estabelecer sessões full-duplex entre aplicações.
E) Criptografar os dados antes da transmissão.

**2.** Em um datagrama IPv4, o campo IHL é usado para:

A) Indicar o protocolo da camada de transporte encapsulado.
B) Definir o tempo máximo de vida do pacote na rede.
C) Informar o tamanho do cabeçalho IP em palavras de 4 bytes.
D) Armazenar o endereço IP de origem.
E) Identificar a porta de destino da aplicação.

**3.** O campo TTL do cabeçalho IP tem como função principal:

A) Determinar a largura de banda máxima da conexão.
B) Evitar que pacotes circulem indefinidamente na rede.
C) Definir o tamanho máximo do payload.
D) Indicar se o pacote usa TCP ou UDP.
E) Criptografar o cabeçalho do datagrama.

**4.** Em relação ao IPv4 e IPv6, a diferença mais importante é que:

A) IPv4 usa 128 bits e IPv6 usa 32 bits.
B) IPv6 foi criado apenas para redes locais privadas.
C) IPv4 possui 32 bits de endereçamento, enquanto IPv6 possui 128 bits.
D) IPv6 não permite roteamento entre redes.
E) IPv4 não utiliza endereços lógicos.

**5.** Um endereço IPv4 público é caracterizado por:

A) Ser usado apenas dentro de redes locais.
B) Não ser roteável na Internet.
C) Ser único e roteável globalmente.
D) Pertencer obrigatoriamente à faixa 192.168.0.0/16.
E) Ser usado exclusivamente para multicast.

**6.** Em um endereço IPv4, o prefixo representa:

A) A parte que identifica a rede.
B) A parte que identifica a porta TCP.
C) O endereço físico do dispositivo.
D) O protocolo da camada de transporte.
E) O número de saltos restantes.

**7.** A operação usada para determinar o endereço de rede a partir de um IP e uma máscara é:

A) OR lógico.
B) XOR lógico.
C) AND lógico.
D) Complemento de dois.
E) Soma binária com carry.

**8.** Para o host `198.168.10.20` com máscara `255.255.0.0`, o endereço de rede é:

A) 198.168.10.0
B) 198.168.0.0
C) 198.0.0.0
D) 255.255.10.20
E) 198.168.255.255

**9.** Em redes classful, uma rede Classe C usa, por padrão, a máscara:

A) 255.0.0.0
B) 255.255.0.0
C) 255.255.255.0
D) 255.255.255.252
E) 255.255.240.0

**10.** Uma rede Classe C tradicional possui quantos endereços úteis para hosts?

A) 128
B) 254
C) 256
D) 510
E) 65.534

**11.** O CIDR permite:

A) Usar apenas máscaras fixas de classe A, B e C.
B) Eliminar totalmente a necessidade de roteadores.
C) Utilizar máscaras de tamanho variável.
D) Substituir portas TCP por endereços IP.
E) Fazer criptografia automática no IP.

**12.** A notação `192.168.0.18/24` indica que:

A) Os primeiros 24 bits identificam a rede.
B) Os últimos 24 bits identificam a rede.
C) O host usa a porta 24.
D) O pacote possui TTL igual a 24.
E) O cabeçalho IP possui 24 bytes.

**13.** A rede `192.168.0.0/26` divide uma rede /24 em:

A) 2 sub-redes de 128 endereços.
B) 4 sub-redes de 64 endereços.
C) 8 sub-redes de 32 endereços.
D) 16 sub-redes de 16 endereços.
E) 64 sub-redes de 4 endereços.

**14.** Na sub-rede `192.168.0.0/26`, o endereço de broadcast da primeira sub-rede é:

A) 192.168.0.0
B) 192.168.0.1
C) 192.168.0.62
D) 192.168.0.63
E) 192.168.0.64

**15.** O endereço `127.0.0.1` é usado para:

A) Broadcast local.
B) Loopback/localhost.
C) Gateway padrão obrigatório.
D) NAT público.
E) Multicast global.

**16.** Um roteador é responsável por:

A) Entregar quadros apenas dentro do mesmo enlace físico.
B) Escolher caminhos para pacotes entre redes diferentes.
C) Converter arquivos JSON em XML.
D) Controlar o token em conexões half-duplex.
E) Definir portas de aplicações no sistema operacional.

**17.** No roteamento por flooding, cada roteador intermediário:

A) Envia o pacote apenas ao vizinho de menor custo conhecido.
B) Descarta todos os pacotes duplicados sem encaminhar nenhum.
C) Envia o pacote para todos os seus vizinhos.
D) Usa apenas informações de estado de enlace.
E) Exige conexão TCP antes de encaminhar.

**18.** Uma desvantagem importante do flooding é:

A) Não encontrar caminho mesmo quando ele existe.
B) Gerar tráfego intenso e risco de loops.
C) Depender de portas UDP.
D) Impedir comunicação host-a-host.
E) Não funcionar em grafos.

**19.** No roteamento por vetor de distância, os roteadores normalmente constroem suas tabelas com base em:

A) Vetores de custo até destinos conhecidos.
B) Endereços MAC de todos os hosts da Internet.
C) Conteúdo criptografado da camada de apresentação.
D) Portas de origem e destino do TCP.
E) Tokens de sessão.

**20.** No roteamento por estado de enlace, cada roteador busca:

A) Enviar pacotes aleatoriamente para todos os vizinhos.
B) Conhecer a topologia da rede e calcular melhores caminhos.
C) Ignorar custos de enlaces.
D) Substituir o endereço IP por endereço MAC.
E) Usar apenas tabelas estáticas configuradas no host final.

**21.** O campo Protocol do cabeçalho IP é usado para:

A) Informar qual protocolo da camada superior está encapsulado.
B) Definir a máscara de rede do host.
C) Controlar a compressão dos dados.
D) Identificar o endereço MAC de destino.
E) Armazenar o número da porta de origem.

**22.** No IPv4, o campo Header Checksum verifica:

A) A integridade do cabeçalho IP.
B) A entrega fim-a-fim dos dados da aplicação.
C) O congestionamento da rede.
D) O conteúdo completo do arquivo transferido.
E) A autenticação do usuário.

**23.** O NAT é usado principalmente para:

A) Permitir que múltiplos IPs privados compartilhem um IP público.
B) Transformar endereços IPv6 em endereços MAC.
C) Substituir o protocolo TCP pelo UDP.
D) Realizar compressão com perdas.
E) Gerenciar sessões half-duplex.

**24.** O ICMP é mais associado a:

A) Controle e mensagens de erro/diagnóstico na rede.
B) Transmissão de vídeo com compressão.
C) Criação de sockets de aplicação.
D) Codificação de strings em ASCII.
E) Controle de token.

**25.** O IGMP é utilizado principalmente em contextos de:

A) Multicast.
B) Criptografia TLS.
C) Three-way handshake.
D) Conversão de endianness.
E) Controle de fluxo TCP.

## Gabarito

1-B, 2-C, 3-B, 4-C, 5-C, 6-A, 7-C, 8-B, 9-C, 10-B, 11-C, 12-A, 13-B, 14-D, 15-B, 16-B, 17-C, 18-B, 19-A, 20-B, 21-A, 22-A, 23-A, 24-A, 25-A
