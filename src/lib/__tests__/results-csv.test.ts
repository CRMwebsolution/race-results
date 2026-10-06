import {describe,it,expect} from 'vitest';
import {csvText} from '../results-csv';
describe('results CSV',()=>{
 it('preserves quoted/newline labels and protects user supplied formulas',()=>{
  expect(csvText([['Racer','Points'],['=HYPERLINK("evil")',0],['A "quoted", racer\nline',12.5]]))
   .toBe('"Racer","Points"\r\n"\'=HYPERLINK(""evil"")","0"\r\n"A ""quoted"", racer\nline","12.5"\r\n');
 });
});
