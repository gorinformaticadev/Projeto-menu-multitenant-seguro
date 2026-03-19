describe("auth cookie options", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.resetModules();
  });

  it("uses HttpOnly cookies with lax same-site and root path in development", async () => {
    process.env.NODE_ENV = "development";
    const module = await import("./auth-cookie.constants");
    const expiresAt = new Date(Date.now() + 60_000);

    expect(module.buildAccessTokenCookieOptions(expiresAt)).toEqual(
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
        maxAge: expect.any(Number),
      }),
    );

    expect(module.buildRefreshTokenCookieOptions(expiresAt)).toEqual(
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
        maxAge: expect.any(Number),
      }),
    );
  });

  it("enables the secure flag in production", async () => {
    process.env.NODE_ENV = "production";
    const module = await import("./auth-cookie.constants");
    const expiresAt = new Date(Date.now() + 60_000);

    expect(module.buildAccessTokenCookieOptions(expiresAt)).toEqual(
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      }),
    );
  });
});
