/**
 * Форматирует дату в сортируемый ISO-подобный формат «гггг-мм-дд чч:мм:сс»
 * (локальное время). Лексикографическая сортировка такого формата совпадает
 * с хронологической. Возвращает null для невалидной даты.
 * @param {Date|number|string} date
 * @returns {string|null}
 */
export function formatIso(date = new Date()) {
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    var p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
