import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import "./Carousel.css";

type NFT = {
  id: string;
  image: string;
};

interface OwnedNFTCarouselProps {
  onNFTSelect: (nft: NFT) => void;
  account: string | null;
}

const OwnedNFTCarousel: React.FC<OwnedNFTCarouselProps> = ({ onNFTSelect, account }) => {
  const [ownedNFTs, setOwnedNFTs] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const NFT_CONTRACT_ADDRESS = "0x0e342F41e1B96532207F1Ad6D991969f4b58e5a1"; // Replace with the actual NFT contract address
  const NFT_ABI = [
    {
      inputs: [{ internalType: "address", name: "owner", type: "address" }],
      name: "tokensOfOwner",
      outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
      name: "tokenURI",
      outputs: [{ internalType: "string", name: "", type: "string" }],
      stateMutability: "view",
      type: "function",
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, internalType: "address", name: "from", type: "address" },
        { indexed: true, internalType: "address", name: "to", type: "address" },
        { indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" },
      ],
      name: "Transfer",
      type: "event",
    },
  ];
  const IPFS_GATEWAY = "https://nftstorage.link/ipfs/";

  const fetchOwnedNFTs = async () => {
    if (!account) {
      setError("No wallet connected.");
      setIsLoading(false);
      return;
    }
  
    try {
      setIsLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
      const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
  
      let tokenIds: string[] = [];
      try {
        // Try fetching token IDs using `tokensOfOwner`
        tokenIds = await nftContract.tokensOfOwner(account);
      } catch (tokensOfOwnerError) {
        console.warn("tokensOfOwner failed, falling back to Transfer logs.");
  
        // Fallback: Fetch token IDs from Transfer logs
        const logs = await provider.getLogs({
          address: NFT_CONTRACT_ADDRESS,
          topics: [
            ethers.id("Transfer(address,address,uint256)"), // Event signature hash
            null,
            ethers.hexlify(ethers.getAddress(account)), // Format the account address correctly
          ],
          fromBlock: 12345678, // Replace with your contract's deployment block
          toBlock: "latest",
        });
  
        tokenIds = logs
          .map((log) => {
            const parsedLog = nftContract.interface.parseLog(log);
            if (!parsedLog) return null; // Handle null cases
            return parsedLog.args.tokenId.toString();
          })
          .filter((tokenId): tokenId is string => tokenId !== null); // Type guard to remove nulls
      }
  
      console.log("Token IDs:", tokenIds);
  
      const nftData = await Promise.all(
        tokenIds.map(async (tokenId: string) => {
          try {
            let tokenURI = await nftContract.tokenURI(tokenId);
            if (tokenURI.startsWith("ipfs://")) {
              tokenURI = tokenURI.replace("ipfs://", IPFS_GATEWAY);
            }
            const response = await fetch(tokenURI);
            if (!response.ok) throw new Error(`Failed to fetch metadata for token ${tokenId}`);
            const metadata = await response.json();
            const imageUrl = metadata.image.startsWith("ipfs://")
              ? metadata.image.replace("ipfs://", IPFS_GATEWAY)
              : metadata.image;
            return { id: tokenId.toString(), image: imageUrl };
          } catch (error) {
            console.error(`Error fetching metadata for token ${tokenId}:`, error);
            return null;
          }
        })
      );
  
      setOwnedNFTs(nftData.filter((nft) => nft !== null));
    } catch (err) {
      console.error("Error fetching owned NFTs:", err);
      setError("Failed to fetch owned NFTs.");
    } finally {
      setIsLoading(false);
    }
  };
  

  // Use effect to fetch NFTs when `account` changes
  useEffect(() => {
    if (account) {
      fetchOwnedNFTs();
    }
  }, [account]);

  if (isLoading) {
    return <div className="loading-message">Loading owned NFTs...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (ownedNFTs.length === 0) {
    return <div className="no-nfts-message">You currently don't own any NFTs in this collection.</div>;
  }

  return (
    <div className="carousel-container">
      {ownedNFTs.map((nft) => (
        <div
          key={nft.id}
          className="carousel-item"
          onClick={() => onNFTSelect(nft)} // Send NFT to parent on select
        >
          <img src={nft.image} alt={`NFT ${nft.id}`} className="nft-image" />
          <p className="nft-id">ID: {nft.id}</p>
        </div>
      ))}
    </div>
  );
};

export default OwnedNFTCarousel;
