
export const formatPrice = (price: number): string => {
  const s = Math.floor(price).toString();
  if (s.length > 3) {
    return s.slice(0, -3) + "." + s.slice(-3);
  }
  return s;
}