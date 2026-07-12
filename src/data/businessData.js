import { APPROVED_REVIEW_CATEGORIES } from "@/lib/validation/review";

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
  email: {
    display: "felixcudjoe1738@gmail.com",
    href: "mailto:felixcudjoe1738@gmail.com",
  },
  googleMapsLink: "https://maps.app.goo.gl/zpYmyrC577QsFdoa9",
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
    name: "displayName",
    label: "Display name",
    type: "text",
    placeholder: "Your name",
    autoComplete: "name",
    required: true,
    errorMessage: "Please enter your display name.",
  },
  {
    id: "review-category",
    name: "category",
    label: "Category",
    type: "select",
    placeholder: "Select a category",
    options: APPROVED_REVIEW_CATEGORIES,
    required: true,
    errorMessage: "Please select an approved review category.",
  },
  {
    id: "review-contact",
    name: "contact",
    label: "Email or phone (optional)",
    type: "text",
    placeholder: "you@example.com or +233 (0) 55 367 1248",
    autoComplete: "email",
  },
];

export const reviewTextareaField = {
  id: "review-message",
  name: "comment",
  label: "Comment",
  placeholder: "Share your feedback here.",
  required: true,
  errorMessage: "Please enter your review comment.",
};

export const reviewRatingField = {
  id: "review-rating",
  name: "rating",
  label: "Rating",
  description: "Select a rating from 1 to 5 stars.",
};

export const reviewConsentField = {
  id: "review-consent",
  name: "consent",
  label: "I confirm that this review may be reviewed before publication.",
  required: true,
  errorMessage: "Please confirm the review consent checkbox.",
};

export const reviewHoneypotField = {
  id: "review-website",
  name: "website",
  label: "Website",
  type: "text",
  autoComplete: "off",
};

export const suggestionFormFields = [
  {
    id: "suggestion-name",
    name: "name",
    label: "Name (optional)",
    type: "text",
    placeholder: "Your name",
    autoComplete: "name",
  },
  {
    id: "suggestion-contact",
    name: "contact",
    label: "Email or phone (optional)",
    type: "text",
    placeholder: "you@example.com or +233 (0) 55 367 1248",
    autoComplete: "email",
  },
];

export const suggestionTextareaField = {
  id: "suggestion-message",
  name: "suggestion",
  label: "Suggestion",
  placeholder: "Share your private suggestion here.",
  required: true,
  errorMessage: "Please enter your suggestion.",
};
