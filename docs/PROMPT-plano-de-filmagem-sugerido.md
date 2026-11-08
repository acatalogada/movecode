Quero construir o **Plano de Filmagem Sugerido**: em vez de o assistente criar os dias e arrastar as tiras manualmente, o sistema propõe automaticamente um plano inicial, otimizado e explicado, que o assistente depois ajusta. Não é o plano definitivo, é um ponto de partida inteligente.

## Arquitetura decidida (híbrida)

**Não** quero que a IA "invente" o plano sozinha: LLM erra conta e viola restrições em problemas combinatórios. A divisão é:

1. **Motor de otimização determinístico** (código, sem IA): distribui as cenas pelos dias respeitando restrições duras e minimizando custos.
2. **Camada Claude**, usada só onde agrega:
   - estimar o **peso/complexidade** de cada cena a partir da sinopse e da decupagem;
   - traduzir **preferências em linguagem natural** em restrições/parâmetros para o motor;
   - **explicar** o plano gerado ("agrupei 12, 34 e 51 porque são a mesma locação e a mesma atriz");
   - permitir **ajustes por conversa** ("joga as externas de praia para a semana 2") e recalcular.
3. **Aprendizado por calibragem** (não é fine-tuning do modelo): comparar o planejado com o realizado (registrado a partir da Ordem do Dia/boletim) e ajustar os pesos por produção e por usuário. Mais tarde, usar planos de filmagem reais de outros filmes (com autorização) como referência para calibrar os pesos iniciais e as médias de páginas/dia por gênero e tipo de cena.

## Regras do motor

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

## Entradas novas que o usuário vai preencher
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
- `pages/api/projects/[id]/shooting-plans/[planId]/recalculate-days.js`, que hoje só divide `scene_order` em fatias iguais entre os dias: **é aí que o motor deve entrar** (ou num endpoint novo de sugestão);
- `lib/analyze.js` já chama o Claude (reaproveitar essa integração);
- `lib/migrate.js` para as migrações;
- `pages/project/[id]/od.js` é a Ordem do Dia (fonte futura do "realizado").

## Plano de implementação em fases
- **Fase 1 (MVP, começar agora):** tabelas de preferências e disponibilidades; cálculo do peso com multiplicadores padrão; motor heurístico em JS (agrupar por locação → período DIA/NOITE → elenco, preencher os dias até a meta, depois uma busca local que troca cenas entre dias para reduzir o custo); endpoint `POST /api/projects/[id]/shooting-plans/suggest` que cria um **novo plano** (nunca sobrescreve o plano manual do usuário); botão "Sugerir plano" e uma tela de preferências.
- **Fase 2:** Claude estima a complexidade de cada cena (saída em JSON estruturado, com justificativa curta) e gera a explicação do plano por dia.
- **Fase 3:** endereços e tempo de deslocamento, disponibilidades completas, travas de datas, ajuste do plano por chat.
- **Fase 4:** registro do realizado por dia e calibragem automática dos pesos; importação de planos de referência em PDF (o Claude extrai os dados estruturados).
- **Custo de IA sob controle:** o motor não usa IA. A complexidade de cada cena é calculada uma única vez e salva no banco (de preferência aproveitando a própria chamada de leitura do roteiro), e só é recalculada para cenas alteradas. As chamadas ao Claude para explicação e ajustes devem enviar só um resumo compacto do plano, com prompt caching na parte fixa.
- Se a heurística em JS ficar limitada, avaliar um solver de verdade (ex.: OR-Tools CP-SAT numa função Python serverless na Vercel).

## Como quero que você trabalhe
1. Primeiro **leia o projeto** e me confirme a estrutura atual (tabelas, endpoints, telas do plano de filmagem).
2. Me apresente o **plano da Fase 1** (schema, endpoints, algoritmo, telas) antes de codar e espere meu ok.
3. Implemente em passos pequenos, com o código comentado em português e a interface em português do Brasil.
4. O plano sugerido sempre deve ser editável e reversível. Nunca apagar o trabalho manual do assistente.
5. Me pergunte o que precisar sobre a prática de set. Minhas preferências iniciais: meta padrão de ___ páginas/dia (ou ___ cenas/dia); multiplicadores que considero importantes: ___.
