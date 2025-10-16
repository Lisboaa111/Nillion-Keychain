import { Application, Request, Response } from "express";
import { NillionService } from "../services/nillion-service";
import { asyncHandler, validateRequired } from "../utils/nillion";
import type {
  DelegationRequest,
  CreateCollectionRequest,
  StoreDataRequest,
} from "../types";

export const setupRoutes = (
  app: Application,
  nillionService: NillionService
) => {
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/builder/info", (req, res) => {
    const builderDid = nillionService.getBuilderDid();
    const config = nillionService.getConfig();

    res.json({
      success: true,
      builderDid,
      config,
    });
  });

  app.post(
    "/api/builder/register",
    asyncHandler(async (req: Request, res: Response) => {
      const { name } = req.body;
      const result = await nillionService.registerBuilder(name);

      res.json({
        success: true,
        data: result,
      });
    })
  );

  app.post(
    "/api/collections/create",
    asyncHandler(async (req: Request, res: Response) => {
      const request: CreateCollectionRequest = req.body;
      validateRequired(request, ["collectionId", "name", "schema"]);

      const result = await nillionService.createCollection(request);

      res.json({
        success: true,
        data: result,
      });
    })
  );

  app.post("/api/delegation/create", (req, res) => {
    const request: DelegationRequest = req.body;
    validateRequired(request, ["userDid", "operation"]);

    const delegation = nillionService.createDelegationToken(request);

    res.json({
      success: true,
      delegation,
    });
  });

  app.post("/api/store/prepare", (req, res) => {
    const request: StoreDataRequest = req.body;
    validateRequired(request, ["userDid", "collection", "data"]);

    const delegation = nillionService.createDelegationToken({
      userDid: request.userDid,
      operation: "create",
      collection: request.collection,
    });

    const builderDid = nillionService.getBuilderDid();
    const config = nillionService.getConfig();

    res.json({
      success: true,
      delegation,
      builderDid,
      nodeUrls: config.nildbNodes,
    });
  });

  app.post("/api/data/prepare-read", (req, res) => {
    const { userDid, collection, document } = req.body;
    validateRequired({ userDid, collection, document }, [
      "userDid",
      "collection",
      "document",
    ]);

    const delegation = nillionService.createDelegationToken({
      userDid,
      operation: "read",
      collection,
    });

    const config = nillionService.getConfig();

    res.json({
      success: true,
      delegation,
      nodeUrls: config.nildbNodes,
    });
  });

  app.post("/api/delegation/grant-access", (req, res) => {
    const { userDid, collection, document } = req.body;
    validateRequired({ userDid, collection, document }, [
      "userDid",
      "collection",
      "document",
    ]);

    const delegation = nillionService.createDelegationToken({
      userDid,
      operation: "grantAccess",
      collection,
    });

    const config = nillionService.getConfig();

    res.json({
      success: true,
      delegation,
      nodeUrls: config.nildbNodes,
      collection,
      document,
    });
  });

  app.post("/api/delegation/revoke-access", (req, res) => {
    const { userDid, collection, document } = req.body;
    validateRequired({ userDid, collection, document }, [
      "userDid",
      "collection",
      "document",
    ]);

    const delegation = nillionService.createDelegationToken({
      userDid,
      operation: "revokeAccess",
      collection,
    });

    const config = nillionService.getConfig();

    res.json({
      success: true,
      delegation,
      nodeUrls: config.nildbNodes,
      collection,
      document,
    });
  });

  app.get(
    "/api/subscription/status/:did",
    asyncHandler(async (req: Request, res: Response) => {
      const { did } = req.params;

      if (!did) {
        return res.status(400).json({
          success: false,
          error: "DID is required",
        });
      }

      const hasSubscription = nillionService.hasActiveSubscription(did);

      res.json({
        success: true,
        did,
        hasSubscription,
        message: hasSubscription
          ? "Active subscription found"
          : "No active subscription",
      });
    })
  );
};
