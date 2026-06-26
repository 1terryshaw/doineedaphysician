// Medical-vertical NON-NEGOTIABLE: shown on every page, above the fold.
// Do not remove or weaken without legal sign-off (see app/disclaimer/page.tsx).
export default function EmergencyBanner() {
  return (
    <div
      role="alert"
      className="w-full bg-red-700 text-white text-sm md:text-base font-semibold text-center px-4 py-2"
    >
      <span aria-hidden="true">⚠ </span>
      Medical emergency? Call{" "}
      <a href="tel:911" className="underline font-bold">
        911
      </a>{" "}
      or go to your nearest emergency room. This directory is not for emergency care.
    </div>
  );
}
