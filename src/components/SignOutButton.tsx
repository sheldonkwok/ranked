import { button } from "@/components/ui/button";

export default function SignOutButton() {
  return (
    <form method="post" action="/api/auth/sign-out">
      <button type="submit" className={button({ variant: "ghost", tone: "danger" })}>
        SIGN OUT
      </button>
    </form>
  );
}
