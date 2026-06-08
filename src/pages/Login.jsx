import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { gqlClient } from '@/api/graphqlClient';
import { gql } from 'graphql-request';
import { Mail, Lock, Loader2, ArrowRight, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        email
        role
        organizationId
      }
    }
  }
`;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { checkAppState } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      const data = await gqlClient.request(LOGIN_MUTATION, {
        email,
        password
      });

      if (data.login && data.login.token) {
        localStorage.setItem('token', data.login.token);
        await checkAppState();
        if (data.login.user.role === 'EMPLOYEE') {
          window.location.href = '/employeeselfservice';
        } else {
          window.location.href = '/';
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Invalid credentials. Please check your email and password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans">
      {/* Left Panel: Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 sm:p-12 lg:p-24 relative z-10">
        <div className="w-full max-w-md space-y-10">
          <div className="text-left">
            <img src="/logo-icon.png" alt="TradeVu Logo" className="w-16 h-auto mb-8" />
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-slate-500 mt-3 text-lg">Sign in to your TradeVu HR workspace.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <Input
                    type="email"
                    data-testid="email-input"
                    placeholder="name@tradevu.com"
                    className="pl-11 py-6 bg-slate-50/50 border-slate-200 text-base rounded-xl focus:ring-slate-900 focus:border-slate-900 transition-colors"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <Input
                    type="password"
                    data-testid="password-input"
                    placeholder="••••••••"
                    className="pl-11 py-6 bg-slate-50/50 border-slate-200 text-base rounded-xl focus:ring-slate-900 focus:border-slate-900 transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2.5 block text-sm text-slate-600 cursor-pointer">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <a href="#" className="font-medium text-slate-900 hover:text-slate-700 hover:underline">
                  Forgot password?
                </a>
              </div>
            </div>

            <Button
              type="submit"
              data-testid="login-submit"
              disabled={isLoading}
              className="w-full py-6 text-base font-medium bg-slate-900 text-white hover:bg-slate-800 shadow-md hover:shadow-lg transition-all rounded-xl"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>
          
          <div className="text-center pt-6">
            <p className="text-sm text-slate-500">
              Need help? <a href="#" className="font-medium text-slate-900 hover:underline">Contact IT Support</a>
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel: Showcase */}
      <div className="hidden lg:block lg:w-1/2 relative bg-slate-900 overflow-hidden shadow-2xl">
        {/* Dark subtle overlay for contrast */}
        <div className="absolute inset-0 bg-slate-900/40 mix-blend-multiply z-10" />
        
        {/* Background Image */}
        <img 
          src="/bg-login.png" 
          alt="TradeVu Abstract" 
          className="absolute inset-0 w-full h-full object-cover opacity-90 scale-105" 
        />
        
        {/* Content overlay */}
        <div className="absolute inset-0 z-20 flex flex-col justify-end p-16 pb-24 text-white bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm font-medium text-white/90 shadow-sm">
              ✨ TradeVu Enterprise 2.0
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight tracking-tight text-white drop-shadow-sm">
              Empower your workforce.
            </h2>
            <p className="text-lg lg:text-xl text-slate-200 leading-relaxed font-light drop-shadow">
              The unified platform for modern enterprises to manage talent, payroll, and organizational intelligence securely.
            </p>
          </div>
          
          <div className="mt-12 flex items-center space-x-6">
            <div className="flex -space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden">
                  <UserCircle className="w-8 h-8 text-slate-400" />
                </div>
              ))}
            </div>
            <p className="text-sm font-medium text-slate-300">
              Trusted by <span className="text-white">10,000+</span> professionals
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
