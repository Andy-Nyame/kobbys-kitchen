import "../globals.css";
import Link from "next/link";

export default function AuthLayout({ children }) {
  return (
    <div className="auth-shell">
      <div className="auth-shell__inner">
        <header className="auth-header">
          <Link className="auth-header__brand" href="/">
            <span className="auth-header__name">Kobby&rsquo;s Kitchen</span>
            <span className="auth-header__tagline">Tema Community Two</span>
          </Link>
        </header>
        <main className="auth-main">{children}</main>
        <footer className="auth-footer">
          <p>
            &copy; {new Date().getFullYear()} Kobby&rsquo;s Kitchen. All rights
            reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
