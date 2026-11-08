Quero construir o **Plano de Filmagem Sugerido**: em vez de o assistente criar os dias e arrastar as tiras manualmente, o sistema propõe automaticamente um plano inicial, otimizado e explicado, que o assistente depois ajusta. Não é o plano definitivo, é um ponto de partida inteligente.

> **Importante:** nada do que está abaixo é regra nem foi decidido. É um resumo das ideias que levantei numa conversa anterior, para discutirmos juntos. Questione, proponha alternativas e me diga o que você faria diferente antes de implementarmos qualquer coisa.

## Arquitetura proposta (híbrida, para discutirmos)

A ideia é não deixar a IA "inventar" o plano sozinha, porque LLM erra conta e viola restrições em problemas combinatórios. A divisão sugerida é:

1. **Motor de otimização determinístico** (código, sem IA): distribui as cenas pelos dias respeitando restrições duras e minimizando custos.
2. **Camada Claude**, usada só onde agrega:
   - estimar o **peso/complexidade** de cada cena a partir da sinopse e da decupagem;
   - traduzir **preferências em linguagem natural** em restrições/parâmetros para o motor;
   - **explicar** o plano gerado ("agrupei 12, 34 e 51 porque são a mesma locação e a mesma atriz");
   - permitir **ajustes por conversa** ("joga as externas de praia para a semana 2") e recalcular.
3. **Aprendizado por calibragem** (não é fine-tuning do modelo): comparar o planejado com o realizado (registrado a partir da Ordem do Dia/boletim) e ajustar os pesos por produção e por usuário. Mais tarde, usar planos de filmagem reais de outros filmes (com autorização) como referência para calibrar os pesos iniciais e as médias de páginas/dia por gênero e tipo de cena.

## Possíveis regras do motor

**Restrições duras (nunca violar):**
- datas fixas e indisponibilidades de locação;
- disponibilidade de elenco (datas em que cada ator pode ou não pode);
- descanso mínimo entre diárias (turnaround, ex.: 11–12h), considerando principalmente a passagem de noturna para diurna;
- limite de horas da diária e regras especiais (ex.: elenco infantil);
- capacidade máxima do dia (páginas ou peso).

**Objetivos a otimizar (com pesos configuráveis):**
- minimizar trocas de locação dentro do dia e o deslocamento entre locações (usando endereços);
- agrupar diurnas com diurnas e noturnas com noturnas, e formar blocos de noturnas;
- concentrar os dias de cada ator (diária de elenco custa caro);
- equilibrar o peso dos dias de acordo com a meta do assistente;
- respeitar as preferências (começar por cenas leves, deixar a cena-chave para o meio do cronograma etc.).

**Peso da cena:** páginas (em oitavos) × multiplicadores, por exemplo: externa, noturna, figuração (por faixa de quantidade), veículos, VFX/efeitos, dublês/ação, crianças, animais, chuva/efeito especial, número de personagens. Os multiplicadores começam com valores padrão, são editáveis pelo usuário e o Claude pode sugerir um ajuste por cena (com justificativa) a partir da sinopse.

## Entradas novas que o usuário poderia preencher
- data de início, dias de folga e número de dias disponíveis (ou "calcule quantos dias preciso");
- meta por dia: páginas **ou** cenas (e tolerância, ex.: 4 a 5 páginas);
- preferência de horário: começar de dia, de noite ou misto;
- endereço de cada locação (para calcular deslocamento; pode começar com uma matriz manual de tempos e depois integrar uma API de mapas);
- disponibilidade de cada ator e de cada locação;
- datas fixas/travadas ("cena 40 obrigatoriamente dia 15");
- preferências livres em texto, interpretadas pelo Claude.

## O que já existe no código (verifique antes de mudar)
No repositório anterior (`screenplay-vercel-fixed`) a estrutura era esta. Confira se continua igual no projeto atual:
- tabela `scenes` com `scene_number`, `int_ext`, `location`, `set_name`, `day_night`, `synopsis`, `characters`, `props`, `wardrobe`, `vfx`, `vehicles`, `extras` (JSONB), `estimated_pages`, `is_flashback`;
- tabelas `shooting_plans` (com `scene_order`) e `shooting_days` (com `scene_ids`, `position`);
- `pages/api/projects/[id]/shooting-plans/[planId]/recalculate-days.js`, que hoje só divide `scene_order` em fatias iguais entre os dias: **um candidato para o motor entrar** (ou num endpoint novo de sugestão);
- `lib/analyze.js` já chama o Claude (reaproveitar essa integração);
- `lib/migrate.js` para as migrações;
- `pages/project/[id]/od.js` é a Ordem do Dia (fonte futura do "realizado").

## Uma possível divisão em fases
- **Fase 1 (MVP, começar agora):** tabelas de preferências e disponibilidades; cálculo do peso com multiplicadores padrão; motor heurístico em JS (agrupar por locação → período DIA/NOITE → elenco, preencher os dias até a meta, depois uma busca local que troca cenas entre dias para reduzir o custo); endpoint `POST /api/projects/[id]/shooting-plans/suggest` que cria um **novo plano** (nunca sobrescreve o plano manual do usuário); botão "Sugerir plano" e uma tela de preferências.
- **Fase 2:** Claude estima a complexidade de cada cena (saída em JSON estruturado, com justificativa curta) e gera a explicação do plano por dia.
- **Fase 3:** endereços e tempo de deslocamento, disponibilidades completas, travas de datas, ajuste do plano por chat.
- **Fase 4:** registro do realizado por dia e calibragem automática dos pesos; importação de planos de referência em PDF (o Claude extrai os dados estruturados).
- Se a heurística em JS ficar limitada, avaliar um solver de verdade (ex.: OR-Tools CP-SAT numa função Python serverless na Vercel).

## Economia de IA (ponto importante para analisarmos)
Já temos custo com a leitura de roteiro pela IA, então quero que essa funcionalidade custe o mínimo possível. Ideias para avaliarmos:
- **Aproveitar a análise de roteiro que já é feita pela IA para gerar a complexidade de cada cena.** Em vez de uma chamada nova, a mesma chamada que já faz a decupagem poderia devolver também um campo de complexidade (fatores + nota + justificativa curta). O custo extra seria só de alguns tokens de saída por cena. Quero que você analise o fluxo atual de leitura (`lib/analyze.js`, `process-chunk.js`) e me diga se isso é viável e qual o impacto. Para projetos já processados, uma chamada separada e barata só para calcular a complexidade.
- O motor de otimização roda sem IA (custo zero de API).
- Calcular a complexidade uma vez, salvar no banco e só recalcular as cenas alteradas.
- Nas chamadas de explicação e ajuste por conversa, mandar só um resumo compacto do plano (nunca o roteiro inteiro) e usar prompt caching na parte fixa do prompt.
- Minha estimativa inicial (a confirmar): com o modelo atual, algo como US$ 0,50 a 0,70 por filme no uso completo; quase zero se a complexidade vier junto da leitura do roteiro.
- **Modelo:** hoje usamos o `claude-sonnet-4-6`, escolhido depois de testes nossos como o melhor para a decupagem. Existe o Claude Sonnet 5.5, cerca de 33% mais barato. Não é para trocar; é só um assunto que podemos reconversar depois, com testes comparativos.

## Material de referência sobre a lógica do plano de filmagem
- Monografia da USP sobre assistência de direção (plano de filmagem, Day-Out-Of-Days): https://bdta.abcd.usp.br/directbitstream/eef33b43-bcb9-440f-b081-294cda16f8e4/tc4626-julia-sonehara-assistencia.pdf
- TCC da UFSC com exemplos de plano de filmagem e diferença para a Ordem do Dia: https://repositorio.ufsc.br/bitstream/handle/123456789/269948/TCC%20L%C3%ADgia%20Mota%20-%20Workshop%20Producao%20Audiovisual%20em%20Contexto%20Universitario%20-%20Memorial%20(1).pdf?sequence=1
- Modelo de plano de filmagem da UNILA: https://portal.unila.edu.br/graduacao/cinemaeaudiovisual/arquivos/PlanodeFilmagem_PORT.pdf
- Storiara: stripboard e one-line schedule preenchidos para um longa fictício de 12 dias, e um guia de leitura de planos: https://storiara.com/templates/stripboard e https://storiara.com/learn/shooting-schedules
- StudioBinder: modelo de shooting schedule: https://www.studiobinder.com/blog/downloads/film-production-shooting-schedule-template/
- Em espanhol só encontrei modelos de curta ou acadêmicos, como o da Universidade de Guanajuato: https://blogs.ugto.mx/rea/clase-digital-6-fases-de-la-produccion-cinematografica/

**Conclusão da pesquisa:** planos reais completos de longas quase não são públicos, porque são documentos internos das produções. E planos de outros filmes ajudam pouco sem o roteiro correspondente, porque não dá para comparar o sugerido com o realizado. Para a lógica, o estudo (TCCs e guias acima) e a minha experiência de set bastam.

## Planos reais com roteiro como "gabarito" (ideia para discutirmos)
Vou tentar separar projetos antigos meus (e talvez de colegas assistentes, com autorização) que tenham **o roteiro e o plano de filmagem final**. A ideia de uso:
1. Processar o roteiro no CineCall normalmente.
2. Gerar o plano sugerido com as mesmas condições daquela produção (número de dias, locações, disponibilidades, meta de páginas).
3. Comparar o plano sugerido com o plano real: agrupamentos por locação, número de trocas de locação por dia, dias de cada ator, páginas por dia, ordem das diurnas e noturnas.
4. Usar as diferenças para calibrar os pesos e as regras do motor.

Esse conjunto de projetos viraria um teste fixo: a cada mudança no motor, rodamos de novo e vemos se o plano sugerido ficou mais próximo do real. Me ajude a pensar em como medir essa "proximidade" e em como armazenar esses projetos de referência (talvez também importando o plano real em PDF ou planilha, com o Claude extraindo os dados).

## Outras pautas para conversarmos (nada decidido)
Não fazem parte do plano sugerido. São ideias e incômodos que quero discutir com você. Nada aqui é decisão: quero sua opinião, alternativas e prós e contras antes de mexer em qualquer coisa.

**1. Planos da cena e horário de cada um, compactos dentro da tira (pauta).**
Vi num dos TCCs um stripboard que mostra, dentro da própria tira, os planos da cena com uma descrição bem curta e o horário previsto de cada um, ocupando pouquíssimo espaço. Por exemplo, uma cena com 3 planos mostra o hora a hora de cada plano. Gostaria de conversar sobre ter algo assim no CineCall, por exemplo:
- uma linha discreta por plano (número/tipo do plano, descrição curtinha, horário previsto), que pode ser recolhida ou expandida;
- os horários calculados a partir do horário de início do dia e da duração estimada de cada plano/setup;
- isso conversa com o plano sugerido: a duração dos planos ajuda a estimar o peso real da cena e se o dia "cabe".
Me ajude a pensar em onde guardar os planos (tabela própria ligada à cena?) e em como mostrar sem poluir a tira.

**2. Um jeito mais visual de inserir itens, além do botão direito (pauta).**
Hoje, para inserir coisas no stripboard (dia de filmagem, dia de folga, banner, referência visual, link para mapa, observação), usamos o botão direito e o botão "+" entre as tiras. O menu está ficando com informação demais e confunde. Ideias para discutirmos:
- uma barra ou paleta visual (lateral ou no topo) com os tipos de item como ícones/cartões, de onde a pessoa **arrasta e solta** o item no ponto desejado do stripboard;
- manter o botão direito como atalho, mas mais enxuto;
- pensar em celular/tablet também (toque em vez de arrastar, se for o caso).
No código antigo, o menu de inserção ficava em `pages/project/[id]/index.js` (lista `options` com `shooting_day`, `day_off_manual`, `banner`, `visual_ref`, `map_link`, `note`, e a função `insertAt`). Confira como está no projeto atual.

**3. Fontes do site e do stripboard (pauta).**
Pode ser impressão minha, mas acho que existe uma fonte com leitura melhor para o site e principalmente para o stripboard. Não precisa ser grande; precisa ter leitura perfeita mesmo em tamanho pequeno (tiras densas, números de cena, páginas em oitavos, IDs de elenco). Gostaria de ficar o mais próximo possível do visual do Movie Magic Scheduling, que é a referência do mercado (não sei qual fonte ele usa; vale pesquisarmos). Também quero redefinir as fontes do sistema como um todo (hierarquia, tamanhos, pesos).
- No código antigo: a interface usava a fonte do sistema (`styles/globals.css`: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`), as exportações/impressões usavam `Arial` com 9–12px (`lib/exports.js` e trechos de `pages/project/[id]/index.js`), e o banner tem um seletor de fontes (`FONTS`). Confira como está hoje.
- Pontos para avaliarmos: fontes pensadas para leitura em tamanho pequeno (com e sem versão condensada, que ajuda tiras estreitas), números tabulares (alinhados em colunas), diferença clara entre 0/O e 1/l/I, consistência entre a tela e o PDF impresso, e carregamento rápido (ex.: via `next/font`).
- Me traga algumas opções com prós e contras, e se possível uma comparação visual de uma tira com cada fonte, antes de decidirmos.

## Como quero que você trabalhe
1. Primeiro **leia o projeto** e me confirme a estrutura atual (tabelas, endpoints, telas do plano de filmagem).
2. Me apresente o **plano da Fase 1** (schema, endpoints, algoritmo, telas) antes de codar e espere meu ok.
3. Implemente em passos pequenos, com o código comentado em português e a interface em português do Brasil.
4. O plano sugerido sempre deve ser editável e reversível. Nunca apagar o trabalho manual do assistente.
5. Lembre que tudo aqui é proposta: discuta comigo antes de decidir.
6. Me pergunte o que precisar sobre a prática de set. Minhas preferências iniciais: meta padrão de ___ páginas/dia (ou ___ cenas/dia); multiplicadores que considero importantes: ___.
