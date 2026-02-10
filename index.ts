import { v0 } from "v0-sdk";

const chat = await v0.chats.create({
	message: "Create a responsive navbar with Tailwind CSS",
});

console.log(chat);
