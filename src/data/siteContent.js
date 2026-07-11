export const homePageContent = {
  eyebrow: "Primary Pages",
  title: "Kobby’s Kitchen",
  description:
    "The site now keeps Home, Menu, About, Contact, and Reviews as the only primary routes, with supporting content placed where it belongs.",
  galleryPreview: {
    title: "Gallery Preview",
    description:
      "The Home page keeps a small gallery preview, while the larger food and business gallery stays on the About page.",
    items: [
      {
        title: "Food Gallery",
        description:
          "Approved food photography will be added here and expanded inside the About page gallery.",
      },
      {
        title: "Business Gallery",
        description:
          "Business and service visuals will stay grouped with the wider About page story.",
      },
      {
        title: "Chef Story",
        description:
          "Chef profile details, portraits, experience, and message now live inside About instead of the primary navigation.",
      },
    ],
  },
  quickLinks: {
    title: "Explore the Primary Routes",
    description:
      "Each main page now has a defined purpose without adding extra navigation tabs.",
    items: [
      {
        title: "Menu",
        href: "/menu",
        description:
          "See where dishes, categories, and event-order information will be organised.",
      },
      {
        title: "About",
        href: "/about",
        description:
          "Find the chef story, portraits, graduation image, and the larger gallery here.",
      },
      {
        title: "Contact",
        href: "/contact",
        description:
          "Keep general enquiries and event-order contact steps together in one route.",
      },
      {
        title: "Reviews",
        href: "/reviews",
        description:
          "Separate public reviews from private suggestions while keeping both easy to find.",
      },
    ],
  },
};

export const menuPageContent = {
  eyebrow: "Menu",
  title: "Menu",
  description:
    "Menu categories and event-order information stay together here instead of becoming separate navigation tabs.",
  sections: [
    {
      title: "Menu Categories",
      description:
        "Approved dishes, categories, and serving details will be organised here once the final menu content is ready.",
    },
    {
      title: "Event Orders",
      description:
        "Event-order details stay within the Menu page, with supporting context also available on the About and Contact pages.",
    },
    {
      title: "Planning Notes",
      description:
        "Questions about larger meal planning can be directed through the Contact page while the full menu structure is being prepared.",
    },
  ],
};

export const aboutPageContent = {
  eyebrow: "About",
  title: "About Kobby’s Kitchen",
  description:
    "This page now brings together the chef story, supporting gallery content, and background information that should not sit in the main navigation.",
  chefStory: {
    title: "Chef Story",
    description:
      "Meet the Chef now lives inside About, with the profile, biography, experience, and chef message grouped together.",
    cards: [
      {
        title: "Chef Profile",
        description:
          "The chef profile belongs here so visitors can understand the person behind Kobby’s Kitchen without leaving the About story.",
      },
      {
        title: "Biography",
        description:
          "Approved biography copy will be added here once it is ready for publication.",
      },
      {
        title: "Experience",
        description:
          "Professional experience, training, and key milestones will be published here when the final copy is approved.",
      },
      {
        title: "Chef Message",
        description:
          "A personal message from the chef will appear here after the final wording is confirmed.",
      },
    ],
  },
  gallery: {
    title: "Food and Business Gallery",
    description:
      "The larger gallery sits on the About page. Current approved images are placed here, with room for additional food and business photography.",
  },
  eventOrders: {
    title: "Event Orders",
    description:
      "Event-order background information also stays inside About so it remains part of the wider brand story instead of becoming a separate route.",
  },
};

export const aboutGalleryItems = [
  {
    title: "Chef Uniform Photograph",
    description: "Current approved chef portrait for the About page.",
    image: {
      src: "/images/people/felix-chef.jpg",
      alt: "Chef in uniform for Kobby’s Kitchen",
      width: 1254,
      height: 1254,
    },
  },
  {
    title: "Graduation Portrait",
    description: "Current approved graduation portrait for the About page.",
    image: {
      src: "/images/people/felix-graduation.jpg",
      alt: "Graduation portrait for the Kobby’s Kitchen chef",
      width: 1067,
      height: 1475,
    },
  },
  {
    title: "Food Gallery",
    description:
      "Additional approved food photography will be added here as the full gallery grows.",
  },
  {
    title: "Business Gallery",
    description:
      "Additional approved business and service images will be added here alongside the food gallery.",
  },
];

export const contactPageContent = {
  eyebrow: "Contact",
  title: "Contact",
  description:
    "General enquiries and event-order contact steps stay together on this page.",
  sections: [
    {
      title: "General Enquiries",
      description:
        "Approved contact details and preferred enquiry methods will be added here when they are ready to publish.",
    },
    {
      title: "Event Orders",
      description:
        "Event-order questions should stay connected to the Menu and About pages rather than becoming a separate navigation tab.",
    },
    {
      title: "Next Steps",
      description:
        "Use this page as the main path for questions about menu planning, event availability, and future updates.",
    },
  ],
};

export const reviewsPageContent = {
  eyebrow: "Reviews",
  title: "Reviews",
  description:
    "Public reviews stay here, while private suggestions move to their own supporting route.",
  sections: [
    {
      title: "Customer Reviews",
      description:
        "Approved testimonials and review highlights will be published here once they are ready to share.",
    },
    {
      title: "Private Suggestions",
      description:
        "Private suggestions should not appear in the primary navigation. Use the dedicated Suggestions page instead.",
    },
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

export const suggestionsPageContent = {
  eyebrow: "Supporting Route",
  title: "Private Suggestions",
  description:
    "This page stays outside the primary navigation and provides a separate place for private feedback.",
  sections: [
    {
      title: "Private Feedback",
      description:
        "Use this space for private suggestions that should not appear alongside public reviews.",
    },
    {
      title: "Supporting Route Only",
      description:
        "This page is linked from Reviews and the footer, but it does not appear as a primary navigation tab.",
    },
  ],
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

export const privacyPageContent = {
  eyebrow: "Supporting Route",
  title: "Privacy",
  description:
    "This page stays outside the primary navigation and supports the review and suggestion forms.",
  sections: [
    {
      title: "Form Privacy",
      description:
        "The approved privacy wording for review and suggestion forms will be published here before those forms go live.",
    },
    {
      title: "Where Privacy Appears",
      description:
        "Privacy is linked from the footer, the review form, and the suggestion form instead of appearing in the primary navigation.",
    },
  ],
};
