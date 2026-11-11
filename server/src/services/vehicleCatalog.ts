export const vehicleCatalog = [
  { code: "sedan_01", name: "Седан «Вектор»", price: 18000n, category: "SEDAN" },
  { code: "hatch_01", name: "Хэтчбек «Старт»", price: 12000n, category: "HATCHBACK" },
  { code: "suv_01", name: "Внедорожник «Тайга»", price: 42000n, category: "SUV" },
  { code: "van_01", name: "Фургон «Маршрут»", price: 28000n, category: "VAN" }
] as const;

export function getVehicleCatalog() {
  return vehicleCatalog.map(({ price, ...item }) => ({ ...item, price: price.toString() }));
}
