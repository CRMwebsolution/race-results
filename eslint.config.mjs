import nextVitals from 'eslint-config-next/core-web-vitals';
const config = [
 ...nextVitals,
 {ignores:['.next/**','node_modules/**','playwright-report/**','test-results/**']},
 {rules:{
   // The existing Supabase/generated JSON boundaries intentionally use broad types.
   '@typescript-eslint/no-explicit-any':'off',
   '@typescript-eslint/no-unused-vars':'off',
   'react-hooks/set-state-in-effect':'off',
   'react-hooks/refs':'off',
 }},
 ];
export default config;
