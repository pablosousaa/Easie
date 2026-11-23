import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Cloud,
  FileText,
  Users,
} from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Textos em segundos",
    body: "Gere 3 a 5 variações prontas para colar no Facebook, com o seu link de afiliado.",
  },
  {
    icon: Users,
    title: "Grupos sob controle",
    body: "Cadastre grupos, regras e status. Checklist por produto evita post repetido.",
  },
  {
    icon: ClipboardList,
    title: "Fila e histórico",
    body: "Saiba o que falta divulgar e o que já foi postado, com data e grupo.",
  },
  {
    icon: Cloud,
    title: "Conta na nuvem",
    body: "Login individual, backup CSV e dados privados. Troque de aparelho sem perder nada.",
  },
] as const;

export function LandingPage() {
  return (
    <div className="marketing">
      <header className="mkt-nav">
        <div className="mkt-nav__inner">
          <Link href="/" className="saas-logo">
            Easie<span>.</span>
          </Link>
          <nav className="mkt-nav__links" aria-label="Seções">
            <a href="#recursos">Recursos</a>
            <a href="#como">Como funciona</a>
          </nav>
          <div className="mkt-nav__actions">
            <Link href="/conta" className="mkt-link">
              Entrar
            </Link>
            <Link href="/conta?next=%2Fgerar" className="btn btn-primary btn-sm">
              Começar
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mkt-hero">
          <div className="mkt-hero__copy animate-appear">
            <p className="mkt-hero__badge">Afiliados do Mercado Livre · envio manual</p>
            <h1 className="mkt-hero__title">
              Divulgue ofertas nos grupos — sem bagunça e sem robô
            </h1>
            <p className="mkt-hero__sub">
              Gere textos variados, marque o que já postou e mantenha tudo na sua conta. O
              envio no Facebook continua manual — como deve ser.
            </p>
            <div className="mkt-hero__cta">
              <Link href="/conta?next=%2Fgerar" className="btn btn-primary btn-lg">
                Criar conta e abrir
                <ArrowRight size={18} strokeWidth={1.5} aria-hidden />
              </Link>
              <Link href="/conta" className="btn btn-secondary btn-lg">
                Já tenho conta
              </Link>
            </div>
          </div>

          <div className="mkt-mockup animate-appear delay-1" aria-hidden>
            <div className="mkt-mockup__frame">
              <div className="mkt-mockup__chrome">
                <span />
                <span />
                <span />
                <p>Gerar posts</p>
              </div>
              <div className="mkt-mockup__body">
                <div className="mkt-mockup__sidebar">
                  <div className="is-on" />
                  <div />
                  <div />
                  <div />
                </div>
                <div className="mkt-mockup__panel">
                  <p className="mkt-mockup__label">Produto</p>
                  <div className="mkt-mockup__bar" />
                  <div className="mkt-mockup__bar short" />
                  <div className="mkt-mockup__cards">
                    <div className="mkt-mockup__card is-active">
                      <span>Variação 1</span>
                      <em />
                      <em />
                    </div>
                    <div className="mkt-mockup__card">
                      <span>Variação 2</span>
                      <em />
                      <em />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mkt-section" id="recursos">
          <p className="mkt-kicker">Recursos</p>
          <h2 className="mkt-section__title">Tudo que o afiliado precisa no celular</h2>
          <p className="mkt-section__sub">
            Do texto ao checklist — organizado, privado e pronto para colar.
          </p>
          <ul className="mkt-features">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="mkt-feature">
                <div className="mkt-feature__icon" aria-hidden>
                  <Icon size={18} strokeWidth={1.5} />
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mkt-section" id="como">
          <p className="mkt-kicker">Fluxo</p>
          <h2 className="mkt-section__title">Três passos por produto</h2>
          <ol className="mkt-steps">
            <li>
              <strong>1</strong> Cadastre o link, nome e preço
            </li>
            <li>
              <strong>2</strong> Gere variações e copie
            </li>
            <li>
              <strong>3</strong> Abra o grupo, cole e marque postado
            </li>
          </ol>
          <ul className="mkt-checks">
            <li>
              <CheckCircle2 size={18} strokeWidth={1.5} aria-hidden /> Sem automação do
              Facebook
            </li>
            <li>
              <CheckCircle2 size={18} strokeWidth={1.5} aria-hidden /> Dados só da sua conta
            </li>
            <li>
              <CheckCircle2 size={18} strokeWidth={1.5} aria-hidden /> Backup CSV quando
              quiser
            </li>
          </ul>
        </section>

        <section className="mkt-cta">
          <div className="mkt-cta__box">
            <h2>Pronto para organizar a divulgação</h2>
            <p>Crie sua conta e gere o primeiro post em menos de um minuto.</p>
            <Link href="/conta?next=%2Fgerar" className="btn btn-primary btn-lg">
              Criar conta
              <ArrowRight size={18} strokeWidth={1.5} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="mkt-footer">
        <Link href="/" className="saas-logo">
          Easie<span>.</span>
        </Link>
        <p>Divulgação de afiliados · envio manual nos grupos</p>
      </footer>
    </div>
  );
}
