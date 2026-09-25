import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>주소를 확인하거나 개요 화면으로 이동해 주세요.</p>
      <Link href="/">개요로 이동</Link>
    </main>
  );
}
