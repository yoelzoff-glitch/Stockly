import { Skeleton } from "@/components/ui/skeleton";

export default function MessagesLoading() {
  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] p-8 pt-6">
      <div className="flex items-center justify-between space-y-2 mb-4">
        <Skeleton className="h-9 w-48" />
      </div>
      <Skeleton className="h-5 w-96 mb-6" />
      
      <div className="flex-1 border rounded-xl shadow-sm bg-background p-4 flex flex-col gap-4">
        <div className="flex justify-start">
          <Skeleton className="h-12 w-[60%] rounded-2xl rounded-tl-none" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-12 w-[50%] rounded-2xl rounded-tr-none" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-20 w-[70%] rounded-2xl rounded-tl-none" />
        </div>
      </div>
    </div>
  );
}
