export const getFormattedDate = (date) => {
  if (!date) return null;
  const options = { year: "numeric", month: "long", day: "numeric" };
  return new Date(Number(date) / 1_000_000).toLocaleDateString("en-US", options);
};
