# 🎬 Script Breakdown — Deploy na Vercel + Neon (100% gratuito)

## O que você vai precisar
- Conta no **GitHub** (github.com) — gratuito
- Conta na **Vercel** (vercel.com) — gratuito
- Conta no **Neon** (neon.tech) — gratuito permanente
- Chave de API da **Anthropic** (console.anthropic.com) — ~R$0,10–0,50 por roteiro

---

## PASSO 1 — Criar o banco de dados no Neon

1. Acesse **neon.tech** e clique em **"Sign Up"** (pode usar conta Google ou GitHub)
2. Clique em **"New Project"**
3. Dê um nome: `screenplay-platform`
4. Escolha a região: **US East (Ohio)** ou a mais próxima disponível
5. Clique em **"Create Project"**
6. Na tela seguinte, copie a **Connection String**. Ela parece com:
   ```
   postgresql://user:senha@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   **Guarde isso — você vai precisar em breve.**

---

## PASSO 2 — Subir o código no GitHub

1. Acesse **github.com** e clique em **"New"** (novo repositório)
2. Nome: `screenplay-platform`
3. Deixe **Privado** (mais seguro para suas chaves)
4. Clique em **"Create repository"**

Agora envie os arquivos. Se nunca usou Git, a forma mais simples é:
- Na página do repositório, clique em **"uploading an existing file"**
- Arraste todos os arquivos e pastas do projeto
- Clique em **"Commit changes"**

> Se você usa o terminal:
> ```bash
> cd screenplay-vercel
> git init
> git add .
> git commit -m "first commit"
> git branch -M main
> git remote add origin https://github.com/SEU_USUARIO/screenplay-platform.git
> git push -u origin main
> ```

---

## PASSO 3 — Criar as tabelas no banco (rode uma vez)

Antes do deploy, crie as tabelas no Neon:

```bash
# No terminal, na pasta do projeto:
cd screenplay-vercel
npm install

# Crie o arquivo .env.local com suas credenciais:
cp .env.local.example .env.local
# Edite o .env.local e preencha DATABASE_URL e ANTHROPIC_API_KEY

# Rode a migração:
npm run db:migrate
```

Você deve ver:
```
✅ Banco de dados criado com sucesso!
   Tabelas: projects, scenes, team_sessions
```

---

## PASSO 4 — Deploy na Vercel

1. Acesse **vercel.com** e clique em **"Sign Up"** (use a conta do GitHub)
2. Clique em **"Add New Project"**
3. Clique em **"Import"** no repositório `screenplay-platform`
4. Na tela de configuração:
   - **Framework Preset:** Next.js (detectado automaticamente)
   - **Root Directory:** deixe em branco (ou `./`)
5. Clique em **"Environment Variables"** e adicione as duas variáveis:

   | Nome | Valor |
   |------|-------|
   | `DATABASE_URL` | sua connection string do Neon |
   | `ANTHROPIC_API_KEY` | sua chave da Anthropic |

6. Clique em **"Deploy"**

Aguarde 1-2 minutos. Você receberá uma URL como:
```
https://screenplay-platform-xxx.vercel.app
```

**Pronto! Sua plataforma está no ar.** 🎉

---

## PASSO 5 — Configurar domínio personalizado (opcional)

Se quiser um domínio próprio (ex: `breakdown.minhaempresa.com`):

1. Na Vercel, vá em **Settings → Domains**
2. Clique em **"Add Domain"**
3. Digite seu domínio e siga as instruções de DNS

---

## Atualizando o projeto no futuro

Sempre que fizer mudanças no código e enviar para o GitHub, a Vercel faz
o deploy automaticamente em cerca de 1-2 minutos.

```bash
git add .
git commit -m "minha atualização"
git push
```

---

## Resolvendo problemas comuns

### "Erro ao analisar o roteiro"
- Verifique se `ANTHROPIC_API_KEY` está correta nas variáveis da Vercel
- Confirme se a chave tem saldo disponível em console.anthropic.com

### "Erro de banco de dados"
- Verifique se `DATABASE_URL` está correta
- Confirme que rodou `npm run db:migrate` antes do deploy

### "PDF não processa"
- PDFs escaneados (imagens) não têm texto extraível — converta para PDF com texto
- PDFs muito grandes (+50MB) excedem o limite — comprima antes de enviar

### Timeout na Vercel (função demora mais de 60s)
- No plano gratuito da Vercel, funções têm timeout de 60 segundos
- Para roteiros muito longos, pode ser necessário o plano Pro ($20/mês)
- Alternativa: use o Render.com para o backend (sem limite de tempo)

---

## Custos reais

| Serviço | Custo |
|---------|-------|
| Vercel (frontend + API) | **Grátis** |
| Neon (banco de dados) | **Grátis** permanente |
| Anthropic API | ~R$0,10–0,50 por roteiro |
| Domínio personalizado | ~R$50/ano (opcional) |

Para uma equipe pequena analisando até 50 roteiros por mês,
o custo total fica em torno de **R$5 a R$25/mês** (só a API da Anthropic).
