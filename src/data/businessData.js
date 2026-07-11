export const businessData = {
  name: "Kobby’s Kitchen",
  tagline: "Tasty and satisfying meals in Tema Community Two",
  owner: "Felix Papa Kwasi Cudjoe",
  ownerTitle: "Owner and Chef",
  experience: "Three years of cooking and food-selling experience",
  location: {
    area: "Tema Community Two",
    landmark: "Opposite Capt. Bob Cedis Artworks.",
    full: "Tema Community Two, opposite Capt. Bob Cedis Artworks.",
  },
  phone: {
    display: "+233 (0) 55 367 1248",
    href: "tel:+233553671248",
  },
  whatsapp: {
    display: "+233 (0) 55 367 1248",
    href: "https://wa.me/233553671248",
  },
  googleMapsLink: "", // Pending.
  socialLinks: {
    tiktok:
      "https://www.tiktok.com/@kobbyskitchen0?_r=1&_t=ZS-97wx2cMRNzg",
  },
  shortDescription:
    "Kobby’s Kitchen is a fast-food business located in Tema Community Two, serving tasty and satisfying meals in a friendly and welcoming environment.",
  heroDescription:
    "Kobby’s Kitchen serves enjoyable fast-food meals, takeaway orders and food orders for events and special occasions.",
  chefPreviewIntroduction:
    "Felix Papa Kwasi Cudjoe is the owner and chef behind Kobby’s Kitchen. He has three years of experience in cooking and selling food.",
  chefIntroduction:
    "Felix Papa Kwasi Cudjoe is the owner and chef behind Kobby’s Kitchen. He has three years of experience in cooking and selling food, with practical experience in meal preparation, customer service and managing a growing food business.",
  chefMessage:
    "Thank you for visiting Kobby’s Kitchen. We look forward to serving you tasty and satisfying meals in Tema Community Two.",
  whyChooseUs: [
    "Tasty and satisfying meals",
    "Friendly and convenient service",
    "Evening and late-night opening hours",
    "Large-quantity event orders",
    "Easy-to-find Tema Community Two location",
  ],
  services: [
    "Fast-Food and Takeaway",
    "Phone and WhatsApp Orders",
    "Event and Large-Quantity Orders",
  ],
  galleryLabels: ["Food", "Preparation", "Events"],
  reviewEmptyState:
    "No customer reviews have been published yet. Be the first to share your experience.",
  finalCta:
    "Ready to enjoy a satisfying meal or place an order for an event?",
  openingHours: [
    { day: "Monday", hours: "4:00 PM – 12:00 Midnight", closed: false },
    { day: "Tuesday", hours: "Closed", closed: true },
    { day: "Wednesday", hours: "4:00 PM – 12:00 Midnight", closed: false },
    { day: "Thursday", hours: "4:00 PM – 12:00 Midnight", closed: false },
    { day: "Friday", hours: "4:00 PM – 12:00 Midnight", closed: false },
    { day: "Saturday", hours: "4:00 PM – 12:00 Midnight", closed: false },
    { day: "Sunday", hours: "4:00 PM – 12:00 Midnight", closed: false },
  ],
};

export const reviewFormFields = [
  {
    id: "review-name",
    name: "name",
    label: "Name",
    type: "text",
    placeholder: "Your name",
  },
  {
    id: "review-occasion",
    name: "occasion",
    label: "Visit or occasion",
    type: "text",
    placeholder: "How did Kobby’s Kitchen serve you?",
  },
];

export const reviewTextareaField = {
  id: "review-message",
  name: "review",
  label: "Your review",
  placeholder: "Share your feedback here.",
};

export const suggestionFormFields = [
  {
    id: "suggestion-name",
    name: "name",
    label: "Name",
    type: "text",
    placeholder: "Your name",
  },
  {
    id: "suggestion-topic",
    name: "topic",
    label: "Suggestion topic",
    type: "text",
    placeholder: "What is your suggestion about?",
  },
];

export const suggestionTextareaField = {
  id: "suggestion-message",
  name: "suggestion",
  label: "Your suggestion",
  placeholder: "Share your private suggestion here.",
};
