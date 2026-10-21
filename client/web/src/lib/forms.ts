/** A text field of a submitted form: '' when the form has no such field (FormData can also hold files). */
export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

/** The amounts typed into a form's number fields (troops, resources), by key, leaving out the empty and zero ones. */
export function typedAmounts<K extends string>(typed: Partial<Record<K, string>>): Partial<Record<K, number>> {
  const amounts: Partial<Record<K, number>> = {};
  for (const [k, v] of Object.entries<string | undefined>(typed)) {
    const n = Number(v || 0);
    if (n > 0) amounts[k as K] = n;
  }
  return amounts;
}
