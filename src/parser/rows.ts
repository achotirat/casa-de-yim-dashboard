export function extractRows(html: string): string[][] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td) =>
      (td.textContent || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
    )
  );
}

export function plainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body?.textContent || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}
