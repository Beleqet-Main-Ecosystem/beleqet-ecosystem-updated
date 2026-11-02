import ContractWorkspace from '@/features/freelance/components/ContractWorkspace';

export default function ContractPage({ params }: { params: { id: string } }) {
  return <ContractWorkspace id={params.id} />;
}
