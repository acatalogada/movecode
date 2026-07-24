// Normaliza nomes de personagens para evitar duplicação por causa de
// maiúsculas/minúsculas ou acentuação diferente (ex: "ALAN", "Alan", "alan"
// devem ser sempre a mesma pessoa; "Ângela" e "Angela" também).
//
// Estratégia: gera uma CHAVE de comparação (sem acento, tudo maiúsculo, espaços
// extras removidos) para decidir se dois nomes são "a mesma pessoa", mas mantém
// a forma de EXIBIÇÃO sempre em CAIXA ALTA (padrão usado no roteiro), usando a
// primeira grafia encontrada como a "oficial" daquele grupo.

function normalizeKey(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' '); // colapsa espaços duplicados
}

// Para EXIBIÇÃO: sempre em caixa alta, sem acento removido (mantém o acento original
// da primeira grafia vista), só normaliza espaços e maiúsculas.
function normalizeDisplay(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toUpperCase().replace(/\s+/g, ' ');
}

// Recebe uma lista de nomes (com possíveis duplicatas por grafia) e retorna
// a lista única, mantendo a primeira grafia de cada grupo como a "oficial".
function dedupeCharacterNames(names) {
  if (!Array.isArray(names)) return [];
  const seen = new Map(); // key normalizada -> nome de exibição escolhido
  for (const raw of names) {
    const display = normalizeDisplay(raw);
    if (!display) continue;
    const key = normalizeKey(display);
    if (!seen.has(key)) seen.set(key, display);
  }
  return [...seen.values()];
}

// Agrupa uma lista de itens (cenas) por nome de personagem, já normalizado,
// retornando um Map de key normalizada -> { display, items }.
function groupByCharacter(scenes, getCharactersFn) {
  const groups = new Map();
  scenes.forEach(scene => {
    const chars = getCharactersFn(scene) || [];
    chars.forEach(raw => {
      const display = normalizeDisplay(raw);
      if (!display) return;
      const key = normalizeKey(display);
      if (!groups.has(key)) groups.set(key, { display, items: [] });
      groups.get(key).items.push(scene);
    });
  });
  return groups;
}

module.exports = { normalizeKey, normalizeDisplay, dedupeCharacterNames, groupByCharacter };
