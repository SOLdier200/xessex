import AgeGateContent from "./AgeGateContent";

type AgeGatePageProps = {
  searchParams?: { next?: string | string[] };
};

export default function AgeGatePage({ searchParams }: AgeGatePageProps) {
  const nextValue = searchParams?.next;
  const next = Array.isArray(nextValue) ? nextValue[0] : nextValue;
  return <AgeGateContent next={next} />;
}
