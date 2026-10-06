/** Quote every field and neutralize spreadsheet formulas supplied through names. */
export function csvText(rows: readonly (readonly (string|number|null)[])[]): string {
 return rows.map(row=>row.map(value=>{
  let text=String(value??'');
  if(typeof value==='string'&&/^\s*[=+@-]/.test(text))text=`'${text}`;
  return `"${text.replaceAll('"','""')}"`;
 }).join(',')).join('\r\n')+'\r\n';
}
export function downloadResults(filename:string,rows:readonly (readonly (string|number|null)[])[]){
 const url=URL.createObjectURL(new Blob([csvText(rows)],{type:'text/csv;charset=utf-8'}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;
 document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
}
