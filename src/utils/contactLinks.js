function getHrefValue(contact) {
  if (!contact) {
    return "";
  }

  if (typeof contact === "string") {
    return contact;
  }

  return contact.href ?? "";
}

export function getPhoneLink(phone) {
  return getHrefValue(phone);
}

export function getWhatsAppLink(whatsapp) {
  return getHrefValue(whatsapp);
}

export function getContactDisplay(contact) {
  if (!contact) {
    return "";
  }

  if (typeof contact === "string") {
    return contact;
  }

  return contact.display ?? "";
}
