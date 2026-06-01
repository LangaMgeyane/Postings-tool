import { Router } from "express";
import { store } from "../store";

const router = Router();

// Auth
router.post("/auth/login", (req, res) => {
  const { displayName } = req.body as { displayName?: string };
  if (!displayName) {
    res.status(400).json({ error: "displayName is required" });
    return;
  }
  let user = store.findUser(displayName);
  if (!user) {
    user = store.createUser(displayName);
  }
  // Always recompute isAdmin from displayName (trailing underscore)
  const isAdmin = displayName.trim().endsWith("_");
  res.json({ ...user, isAdmin });
});

// Posts
router.get("/posts", (req, res) => {
  const { authorId, status } = req.query as { authorId?: string; status?: string };
  res.json(store.listPosts(authorId, status));
});

router.post("/posts", (req, res) => {
  const { authorId, authorName } = req.body as { authorId?: string; authorName?: string };
  if (!authorId || !authorName) {
    res.status(400).json({ error: "authorId and authorName are required" });
    return;
  }
  const post = store.createPost(req.body, authorId, authorName);
  res.status(201).json(post);
});

router.get("/posts/:postId", (req, res) => {
  const post = store.findPost(req.params.postId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(post);
});

router.patch("/posts/:postId", (req, res) => {
  const post = store.updatePost(req.params.postId, req.body);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(post);
});

// Submit: draft → in-review
router.post("/posts/:postId/submit", (req, res) => {
  const post = store.submitPost(req.params.postId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(post);
});

// Publish: in-review → publish (admin only — caller must verify isAdmin)
router.post("/posts/:postId/publish", (req, res) => {
  const post = store.findPost(req.params.postId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  if (post.status !== "in-review") {
    res.status(400).json({ error: "Post must be in-review to publish" });
    return;
  }
  const published = store.publishPost(req.params.postId);
  res.json(published);
});

// Annotations
router.get("/posts/:postId/annotations", (req, res) => {
  res.json(store.listAnnotations(req.params.postId));
});

router.post("/posts/:postId/annotations", (req, res) => {
  const { authorId, authorName } = req.body as { authorId?: string; authorName?: string };
  if (!authorId || !authorName) {
    res.status(400).json({ error: "authorId and authorName are required" });
    return;
  }
  const ann = store.createAnnotation(req.params.postId, req.body, authorId, authorName);
  res.status(201).json(ann);
});

router.delete("/posts/:postId/annotations/:annId", (req, res) => {
  const deleted = store.deleteAnnotation(req.params.postId, req.params.annId);
  if (!deleted) {
    res.status(404).json({ error: "Annotation not found" });
    return;
  }
  res.status(204).send();
});

// Notes (subset of annotations)
router.get("/posts/:postId/notes", (req, res) => {
  res.json(store.listNotes(req.params.postId));
});

router.post("/posts/:postId/notes", (req, res) => {
  const { authorId, authorName, text, noteType } = req.body as {
    authorId?: string;
    authorName?: string;
    text?: string;
    noteType?: string;
  };
  if (!authorId || !authorName || !text) {
    res.status(400).json({ error: "authorId, authorName, and text are required" });
    return;
  }
  const ann = store.createAnnotation(
    req.params.postId,
    { type: "note", text, noteType },
    authorId,
    authorName,
  );
  res.status(201).json(ann);
});

// Comments
router.get("/posts/:postId/comments", (req, res) => {
  res.json(store.listComments(req.params.postId));
});

router.post("/posts/:postId/comments", (req, res) => {
  const { authorId, authorName, text } = req.body as {
    authorId?: string;
    authorName?: string;
    text?: string;
  };
  if (!authorId || !authorName || !text) {
    res.status(400).json({ error: "authorId, authorName, and text are required" });
    return;
  }
  const comment = store.createComment(req.params.postId, text, authorId, authorName);
  res.status(201).json(comment);
});

router.delete("/posts/:postId/comments/:commentId", (req, res) => {
  const deleted = store.deleteComment(req.params.postId, req.params.commentId);
  if (!deleted) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  res.status(204).send();
});

// Pinboard
router.get("/pinboard/:workspace", (req, res) => {
  res.json(store.getPinboard(req.params.workspace));
});

router.put("/pinboard/:workspace", (req, res) => {
  const data = store.savePinboard(req.params.workspace, req.body);
  res.json(data);
});

export default router;
