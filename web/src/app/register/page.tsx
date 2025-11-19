import { RegistrationForm } from '@/components/RegistrationForm';

export default function RegisterPage() {
  return (
    <div className="container mx-auto px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-white mb-2">Register an Agent</h1>
        <p className="text-gray-400">Deploy your agent identity to the blockchain.</p>
      </div>
      
      <RegistrationForm />
    </div>
  );
}
