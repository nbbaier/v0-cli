import { v0 } from "v0-sdk";

const chats = await v0.chats.find({});
const projects = await v0.projects.getById({
	projectId: "prj_PwnqYRWMkolzA3KDWKjHsTnDP3MF",
});

console.log(projects);
