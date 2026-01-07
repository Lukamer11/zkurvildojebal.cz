function syncStats() {
  // Tohle může být třeba z localStorage nebo z backendu
  const playerData = {
    level: localStorage.getItem("playerLevel") || 5,
    money: localStorage.getItem("playerMoney") || 1234,
    cigarettes: localStorage.getItem("playerCigs") || 88,
    xpText: localStorage.getItem("playerXP") || "45 / 100"
  };

  if (document.getElementById("levelDisplay"))
    document.getElementById("levelDisplay").textContent = playerData.level;

  if (document.getElementById("money"))
    document.getElementById("money").textContent = playerData.money;

  if (document.getElementById("cigarettes"))
    document.getElementById("cigarettes").textContent = playerData.cigarettes;

  if (document.getElementById("xpText"))
    document.getElementById("xpText").textContent = playerData.xpText;
}
