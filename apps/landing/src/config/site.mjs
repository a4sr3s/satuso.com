const isDev = import.meta.env.DEV;

export const SITE = {
  title: "Satuso — Never Lose a Deal Again",
  description: "Track leads, automate follow-ups, and close more sales — all in one place. Sales tracking for solopreneurs and small teams. Ditch the spreadsheets.",
  defaultLanguage: "en",
  url: "https://satuso.com",
  appUrl: isDev ? "http://localhost:5173" : "https://app.satuso.com",
  author: "Satuso",
  ogImage: "/og-image.png",
  keywords: "sales tracking, lead management, deal tracking, solopreneur tools, small business sales, pipeline management, follow-up reminders, close more deals",
  web3formsAccessKey: "",
};
