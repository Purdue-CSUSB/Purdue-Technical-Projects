import { createContext, useContext } from 'react';

// The context object and its hook live here, apart from the provider in AuthContext.jsx.
//
// That split is required rather than stylistic: react-refresh can only hot-reload a module
// whose exports are all components, so a file exporting both <AuthProvider> and useAuth() loses
// fast refresh for the whole auth tree. Keeping the non-component exports in a plain .js module
// gives both halves what they need.
export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
