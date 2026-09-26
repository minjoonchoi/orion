import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { deployment } from "@/lib/api/server";
import { LanguageSelect } from "@/i18n/provider";
import "./login.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("로그인"),
    description: t("Orion — 사내 업무 도구를 위한 통합 인증과 접근 권한 관리"),
    robots: { index: false, follow: false },
  };
}
// Read deployment configuration at request time; no browser-side OIDC credentials.
export const dynamic = "force-dynamic";

function OrionMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M8 7 24 12 10 25 8 7Z"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <circle cx="8" cy="7" r="3" fill="currentColor" />
      <circle cx="24" cy="12" r="3" fill="currentColor" />
      <circle cx="10" cy="25" r="3" fill="currentColor" />
    </svg>
  );
}

export default async function LoginPage() {
  const t = await getT();
  const loginUrl = deployment().loginUrl;
  return (
    <main className="login-page" id="main">
      <div className="login-shell">
        <section
          className="login-identity"
          aria-label={t("Orion 통합 인증 플랫폼")}
        >
          <div className="login-brand">
            <OrionMark />
            <span>ORION</span>
          </div>
          <div className="login-story">
            <p className="login-eyebrow">ONE IDENTITY. CONNECTED WORK.</p>
            <h2>
              {t("하나의 계정.")}
              <br />
              {t("하나의 업무 환경.")}
            </h2>
            <p className="login-story-description">
              {t("사내 업무 도구를 위한")}
              <br />
              {t("통합 인증과 접근 권한의 시작점.")}
            </p>
          </div>
          <div className="login-constellation" aria-hidden="true">
            <svg viewBox="0 0 360 190" fill="none">
              <ellipse
                cx="182"
                cy="96"
                rx="138"
                ry="67"
                transform="rotate(-17 182 96)"
              />
              <path d="m66 104 84-48 66 59 93-48M150 56l-9 102 75-43" />
              <circle cx="66" cy="104" r="5" />
              <circle cx="150" cy="56" r="5" />
              <circle cx="216" cy="115" r="7" />
              <circle cx="309" cy="67" r="4" />
              <circle cx="141" cy="158" r="4" />
            </svg>
          </div>
          <p className="login-identity-caption">IDENTITY & ACCESS PLATFORM</p>
        </section>
        <section className="login-entry" aria-labelledby="login-title">
          <LanguageSelect />
          <div className="login-entry-heading">
            <span className="login-overline">WORKSPACE SIGN IN</span>
            <h1 id="login-title">{t("Orion에 로그인")}</h1>
            <p>
              {t("사내 계정으로 로그인하고")}
              <br className="login-copy-break" />{" "}
              {t("필요한 업무 도구에 접근하세요.")}
            </p>
          </div>
          <div className="login-action-area">
            {loginUrl ? (
              <a
                className="ui-button ui-button--primary login-action"
                href={loginUrl}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="11"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M8 10V7a4 4 0 0 1 8 0v3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                <span>{t("Okta로 로그인")}</span>
                <span className="login-arrow" aria-hidden="true">
                  →
                </span>
              </a>
            ) : (
              <>
                <button
                  className="ui-button ui-button--primary login-action"
                  disabled
                >
                  {t("Okta로 로그인")}
                </button>
                <p className="login-unavailable" role="status">
                  {t("지금은 로그인을 이용할 수 없습니다.")}
                  <br />
                  {t("잠시 후 다시 시도해 주세요.")}
                </p>
              </>
            )}
            <p className="login-redirect-note">
              {t("회사의 Okta 인증 화면으로 이동합니다.")}
            </p>
          </div>
          <div className="login-help">
            <span className="login-help-label">
              {t("도움이 필요하신가요?")}
            </span>
            <p>
              {t("계정 또는 접근 권한은")}
              <br />
              {t("사내 관리자에게 문의해 주세요.")}
            </p>
          </div>
        </section>
      </div>
      <footer className="login-footer">
        <span>ORION</span>
        <p>{t("사내 구성원을 위한 업무 플랫폼")}</p>
      </footer>
    </main>
  );
}
