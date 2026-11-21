import type { Metadata } from "next";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";

export const metadata: Metadata = {
	title: "ShopHub — Premium E-Commerce",
	description: "Discover premium products with fast delivery. Shop electronics, apparel, accessories and more at ShopHub.",
	keywords: "e-commerce, online shopping, premium products, fast delivery",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<ClientProviders>{children}</ClientProviders>
			</body>
		</html>
	);
}
