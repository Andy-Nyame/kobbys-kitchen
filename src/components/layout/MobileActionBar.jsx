import ButtonLink from "@/components/ui/ButtonLink";
import { businessData } from "@/data/businessData";

function ActionLabel({ symbol, text }) {
  return (
    <>
      <span aria-hidden="true" className="mobile-action-bar__symbol">
        {symbol}
      </span>
      <span>{text}</span>
    </>
  );
}

export default function MobileActionBar() {
  const { phone, whatsapp, googleMapsLink } = businessData;

  return (
    <div className="mobile-action-bar" aria-label="Quick contact actions">
      <div className="mobile-action-bar__inner">
        <ButtonLink
          ariaLabel={`Call Kobby’s Kitchen on ${phone.display}`}
          className="mobile-action-bar__link"
          href={phone.href}
          variant="secondary"
        >
          <ActionLabel symbol="C" text="Call" />
        </ButtonLink>
        <ButtonLink
          ariaLabel={`WhatsApp Kobby’s Kitchen on ${whatsapp.display}`}
          className="mobile-action-bar__link"
          href={whatsapp.href}
          rel="noopener noreferrer"
          target="_blank"
          variant="primary"
        >
          <ActionLabel symbol="W" text="WhatsApp" />
        </ButtonLink>
        <ButtonLink
          ariaLabel="Get directions to Kobby’s Kitchen"
          className="mobile-action-bar__link"
          href={googleMapsLink}
          variant="secondary"
        >
          <ActionLabel symbol="D" text="Directions" />
        </ButtonLink>
      </div>
    </div>
  );
}
