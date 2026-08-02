export default function SignOutButton() {
  return (
    <form method="post" action="/api/auth/sign-out">
      <button type="submit" className="pixel-btn-ghost pixel-btn-ghost-danger">
        SIGN OUT
      </button>
    </form>
  );
}
