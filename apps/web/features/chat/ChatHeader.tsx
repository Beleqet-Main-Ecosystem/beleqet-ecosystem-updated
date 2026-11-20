interface Props{
    connected:boolean;
}

export default function ChatHeader({connected}:Props){

return(

<header className="flex items-center justify-between border-b p-5">

<div>

<h2 className="text-xl font-bold">
🔒 Secure Tunnel
</h2>

<p className="text-sm text-gray-500">
AES-256-GCM Protected
</p>

</div>

<div className="flex items-center gap-2">

<div
className={`h-3 w-3 rounded-full ${
connected
? "bg-green-500"
: "bg-red-500"
}`}
/>

<span>

{connected
? "Connected"
: "Disconnected"}

</span>

</div>

</header>

)

}