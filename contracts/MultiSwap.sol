// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ISwapRouter.sol";
import "./interfaces/IWETH9.sol";

contract MultiSwap {
    using SafeERC20 for IERC20;

    struct SwapRequest {
        address[] tokens;
        uint24[] fees;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
    }

    ISwapRouter public immutable swapRouter;
    IWETH9 public immutable weth;

    modifier validateETHAfterSwap() {
        _;
        require(address(this).balance == 0, "invalid value sent");
    }

    constructor(address _swapRouter, address _weth) {
        require(_swapRouter != address(0) && _weth != address(0), "zero addr");
        swapRouter = ISwapRouter(_swapRouter);
        weth = IWETH9(_weth);
    }

    receive() external payable {
        require(msg.sender == address(weth), "invalid sender");
    }

    function singleSwap(SwapRequest calldata request)
        external
        payable
        validateETHAfterSwap
    {
        _singleSwap(request);
    }

    function multiSwap(SwapRequest[] calldata requests)
        external
        payable
        validateETHAfterSwap
    {
        uint256 len = requests.length;
        for (uint256 i; i < len; ) {
            _singleSwap(requests[i]);
            unchecked {
                ++i;
            }
        }
    }

    function _singleSwap(SwapRequest calldata request) internal {
        require(request.tokens.length >= 2, "invalid tokens");
        require(
            request.tokens.length == request.fees.length + 1,
            "invalid fees"
        );
        require(request.amountIn != 0, "zero");
        require(request.deadline >= block.timestamp, "expired");

        address inputToken = request.tokens[0];
        if (inputToken == address(0)) {
            weth.deposit{value: request.amountIn}();

            inputToken = address(weth);
        } else {
            IERC20(inputToken).safeTransferFrom(
                msg.sender,
                address(this),
                request.amountIn
            );
        }

        bytes memory path = abi.encodePacked(inputToken);
        uint256 len = request.fees.length;
        bool receiveEth = request.tokens[len] == address(0);

        unchecked {
            for (uint256 i; i < len; ++i) {
                address token = i == len - 1 && receiveEth
                    ? address(weth)
                    : request.tokens[i + 1];
                path = abi.encodePacked(path, request.fees[i], token);
            }
        }

        IERC20(inputToken).safeApprove(address(swapRouter), request.amountIn);
        uint256 amountOut = swapRouter.exactInput(
            ISwapRouter.ExactInputParams({
                path: path,
                recipient: receiveEth ? address(this) : msg.sender,
                deadline: request.deadline,
                amountIn: request.amountIn,
                amountOutMinimum: request.minAmountOut
            })
        );
        if (receiveEth) {
            weth.withdraw(amountOut);
            (bool success, ) = msg.sender.call{value: amountOut}("");
            require(success, "eth sender fails");
        }
    }
}
