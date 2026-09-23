import Link from "next/link";
export default function NotFound() {
  return (
    <section className="ui-panel">
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>주소를 확인하거나 목록에서 다시 선택해 주세요.</p>
      <Link className="identity-link" href="/pages">
        페이지 목록으로
      </Link>
    </section>
  );
}
